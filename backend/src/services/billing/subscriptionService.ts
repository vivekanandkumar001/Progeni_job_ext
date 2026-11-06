import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { PlanConfigService } from './planConfig.js';
import { UsageCreditEngine } from './usageCreditEngine.js';
import type {
  CandidateSubscription,
  SubscriptionTier,
  BillingInterval,
  SubscriptionStatus,
} from './types.js';

const SUBSCRIPTIONS_COLLECTION = 'candidate_subscriptions';
const SUBSCRIPTION_HISTORY_COLLECTION = 'subscription_history';
const AUDIT_COLLECTION = 'billing_audit_logs';

export class SubscriptionService {
  /**
   * Retrieves or initializes a candidate's subscription record (default Free).
   */
  static async getOrCreateSubscription(candidateId: string): Promise<CandidateSubscription> {
    const db = await getDatabase();
    let subscription = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({
      user_id: candidateId,
    });

    if (!subscription) {
      const now = new Date();
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();

      const newSub: CandidateSubscription = {
        id: randomUUID(),
        candidateId,
        user_id: candidateId,
        tier: 'free',
        status: 'active',
        billingInterval: 'month',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        failedPaymentCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await db.collection<any>(SUBSCRIPTIONS_COLLECTION).insertOne(newSub);
      await UsageCreditEngine.getOrCreateAccount(candidateId, 'free');

      return newSub;
    }

    // Check expiration
    if (
      subscription.status === 'active' &&
      subscription.tier !== 'free' &&
      new Date(subscription.currentPeriodEnd).getTime() <= Date.now()
    ) {
      if (subscription.cancelAtPeriodEnd) {
        subscription = await this.expireSubscription(candidateId);
      }
    }

    return subscription;
  }

  /**
   * Upgrades a subscription to a higher tier immediately following verified payment.
   */
  static async upgradeSubscription(
    candidateId: string,
    newTier: SubscriptionTier,
    interval: BillingInterval = 'month',
    paymentReference?: string,
  ): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const plan = await PlanConfigService.getPlan(newTier);

    const now = new Date();
    const periodMonths = interval === 'year' ? 12 : 1;
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + periodMonths,
      now.getDate(),
    ).toISOString();

    const updates: Partial<CandidateSubscription> = {
      tier: newTier,
      status: 'active',
      billingInterval: interval,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      canceledAt: undefined,
      cancelReason: undefined,
      failedPaymentCount: 0,
      updatedAt: now.toISOString(),
    };

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      { $set: updates },
    );

    // Replenish / expand credit account to match upgraded tier
    await UsageCreditEngine.resetMonthlyQuota(candidateId, newTier);

    // Update user role to premium_candidate if pro/premium
    if (newTier === 'pro' || newTier === 'premium') {
      await db.collection<any>('users').updateOne(
        { $or: [{ id: candidateId }, { _id: candidateId }] },
        { $set: { role: 'premium_candidate', updated_at: now.toISOString() } },
      );
    }

    // Record in subscription history
    await this.recordHistoryEvent({
      candidateId,
      eventType: 'upgraded',
      fromTier: current.tier,
      toTier: newTier,
      paymentReference,
      metadata: { planName: plan.name, interval, price: plan.price.amount },
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Downgrades a subscription (e.g. Premium -> Pro).
   * Scheduled to take effect at the end of the current period.
   */
  static async downgradeSubscription(
    candidateId: string,
    newTier: SubscriptionTier,
  ): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const now = new Date().toISOString();

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $set: {
          tier: newTier,
          updatedAt: now,
        },
      },
    );

    // If downgraded to free, revert user role
    if (newTier === 'free') {
      await db.collection<any>('users').updateOne(
        { $or: [{ id: candidateId }, { _id: candidateId }] },
        { $set: { role: 'candidate', updated_at: now } },
      );
    }

    await this.recordHistoryEvent({
      candidateId,
      eventType: 'downgraded',
      fromTier: current.tier,
      toTier: newTier,
      metadata: { effectiveDate: now },
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Cancels subscription renewal at period end.
   */
  static async cancelSubscription(
    candidateId: string,
    reason?: string,
    immediate = false,
  ): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const now = new Date().toISOString();

    const updates: Partial<CandidateSubscription> = {
      cancelAtPeriodEnd: !immediate,
      status: immediate ? 'canceled' : current.status,
      tier: immediate ? 'free' : current.tier,
      canceledAt: now,
      cancelReason: reason || 'Candidate voluntary cancellation',
      updatedAt: now,
    };

    if (immediate) {
      await db.collection<any>('users').updateOne(
        { $or: [{ id: candidateId }, { _id: candidateId }] },
        { $set: { role: 'candidate', updated_at: now } },
      );
    }

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      { $set: updates },
    );

    await this.recordHistoryEvent({
      candidateId,
      eventType: 'canceled',
      fromTier: current.tier,
      toTier: immediate ? 'free' : current.tier,
      metadata: { reason, immediate },
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Renews subscription for another billing cycle.
   */
  static async renewSubscription(
    candidateId: string,
    paymentReference?: string,
  ): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const now = new Date();

    const periodMonths = current.billingInterval === 'year' ? 12 : 1;
    const currentEnd = new Date(current.currentPeriodEnd);
    const baseDate = currentEnd.getTime() > now.getTime() ? currentEnd : now;
    const newEnd = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + periodMonths,
      baseDate.getDate(),
    ).toISOString();

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $set: {
          status: 'active',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: newEnd,
          cancelAtPeriodEnd: false,
          canceledAt: undefined,
          cancelReason: undefined,
          failedPaymentCount: 0,
          updatedAt: now.toISOString(),
        },
      },
    );

    // Replenish credits
    await UsageCreditEngine.resetMonthlyQuota(candidateId, current.tier);

    await this.recordHistoryEvent({
      candidateId,
      eventType: 'renewed',
      fromTier: current.tier,
      toTier: current.tier,
      paymentReference,
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Expires subscription and downgrades to Free.
   */
  static async expireSubscription(candidateId: string): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const now = new Date().toISOString();

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $set: {
          tier: 'free',
          status: 'expired',
          cancelAtPeriodEnd: false,
          updatedAt: now,
        },
      },
    );

    await db.collection<any>('users').updateOne(
      { $or: [{ id: candidateId }, { _id: candidateId }] },
      { $set: { role: 'candidate', updated_at: now } },
    );

    await UsageCreditEngine.resetMonthlyQuota(candidateId, 'free');

    await this.recordHistoryEvent({
      candidateId,
      eventType: 'expired',
      fromTier: current.tier,
      toTier: 'free',
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Handles payment failures gracefully.
   * Increments failure counter, transitions to 'past_due' after thresholds, and records error details.
   */
  static async handlePaymentFailure(
    candidateId: string,
    invoiceId?: string,
    errorDetails?: string,
  ): Promise<CandidateSubscription> {
    const db = await getDatabase();
    const current = await this.getOrCreateSubscription(candidateId);
    const now = new Date().toISOString();

    const failedCount = current.failedPaymentCount + 1;
    const newStatus: SubscriptionStatus = failedCount >= 3 ? 'past_due' : current.status;

    await db.collection<any>(SUBSCRIPTIONS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $set: {
          status: newStatus,
          failedPaymentCount: failedCount,
          lastPaymentFailure: {
            date: now,
            reason: errorDetails || 'Card declined / Payment timeout',
            invoiceId,
          },
          updatedAt: now,
        },
      },
    );

    await this.recordHistoryEvent({
      candidateId,
      eventType: 'payment_failed',
      fromTier: current.tier,
      toTier: current.tier,
      metadata: { failedCount, errorDetails, invoiceId },
    });

    const updated = await db.collection<any>(SUBSCRIPTIONS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Retrieves subscription history events.
   */
  static async getSubscriptionHistory(candidateId: string): Promise<any[]> {
    const db = await getDatabase();
    return db
      .collection<any>(SUBSCRIPTION_HISTORY_COLLECTION)
      .find({ user_id: candidateId })
      .sort({ timestamp: -1 })
      .toArray();
  }

  private static async recordHistoryEvent(data: {
    candidateId: string;
    eventType: string;
    fromTier: SubscriptionTier;
    toTier: SubscriptionTier;
    paymentReference?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const db = await getDatabase();
    await db.collection<any>(SUBSCRIPTION_HISTORY_COLLECTION).insertOne({
      id: randomUUID(),
      user_id: data.candidateId,
      candidateId: data.candidateId,
      eventType: data.eventType,
      fromTier: data.fromTier,
      toTier: data.toTier,
      paymentReference: data.paymentReference,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
    });
  }
}
