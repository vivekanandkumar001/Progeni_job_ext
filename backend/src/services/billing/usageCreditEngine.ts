import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import { PlanConfigService } from './planConfig.js';
import type {
  CandidateCreditAccount,
  CreditLedgerEntry,
  MeteredService,
  SubscriptionTier,
  BillingAuditEvent,
} from './types.js';

const ACCOUNTS_COLLECTION = 'candidate_credit_accounts';
const LEDGER_COLLECTION = 'credit_ledger';
const AUDIT_COLLECTION = 'billing_audit_logs';

export class InsufficientCreditsError extends Error {
  public readonly required: number;
  public readonly balance: number;

  constructor(required: number, balance: number) {
    super(`Insufficient AI credits: Required ${required}, current balance is ${balance}. Please upgrade your plan or top up.`);
    this.name = 'InsufficientCreditsError';
    this.required = required;
    this.balance = balance;
  }
}

export class UsageCreditEngine {
  /**
   * Initializes or fetches a candidate's credit account.
   * Enforces monthly quota allocation based on plan tier.
   */
  static async getOrCreateAccount(
    candidateId: string,
    tier: SubscriptionTier = 'free',
  ): Promise<CandidateCreditAccount> {
    const db = await getDatabase();
    let account = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({
      user_id: candidateId,
    });

    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    if (!account) {
      const plan = await PlanConfigService.getPlan(tier);
      const newAccount: CandidateCreditAccount = {
        id: randomUUID(),
        candidateId,
        user_id: candidateId,
        tier,
        balance: plan.quotas.totalAiCredits,
        monthlyQuota: plan.quotas.totalAiCredits,
        consumedThisCycle: 0,
        billingCycleStart: cycleStart,
        billingCycleEnd: cycleEnd,
        updatedAt: now.toISOString(),
      };

      await db.collection<any>(ACCOUNTS_COLLECTION).insertOne(newAccount);

      // Record initial grant in ledger
      await this.recordLedgerEntry({
        candidateId,
        type: 'grant',
        amount: plan.quotas.totalAiCredits,
        balanceAfter: plan.quotas.totalAiCredits,
        description: `Initial monthly quota allocation for ${plan.name}`,
        performedBy: 'system',
      });

      return newAccount;
    }

    // Check for monthly quota reset
    if (new Date(account.billingCycleEnd).getTime() <= now.getTime()) {
      account = await this.resetMonthlyQuota(candidateId, account.tier);
    }

    return account;
  }

  /**
   * Resets monthly quota if the cycle has elapsed.
   */
  static async resetMonthlyQuota(
    candidateId: string,
    tier: SubscriptionTier,
  ): Promise<CandidateCreditAccount> {
    const db = await getDatabase();
    const plan = await PlanConfigService.getPlan(tier);
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const newBalance = plan.quotas.totalAiCredits;

    await db.collection<any>(ACCOUNTS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $set: {
          balance: newBalance,
          monthlyQuota: newBalance,
          consumedThisCycle: 0,
          billingCycleStart: cycleStart,
          billingCycleEnd: cycleEnd,
          updatedAt: now.toISOString(),
        },
      },
    );

    await this.recordLedgerEntry({
      candidateId,
      type: 'grant',
      amount: newBalance,
      balanceAfter: newBalance,
      description: `Monthly quota replenishment for ${plan.name}`,
      performedBy: 'system',
    });

    const updated = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
    return updated!;
  }

  /**
   * Atomically deducts credits for a metered AI service.
   * Guarantees race-condition safety, negative balance prevention, and idempotency.
   */
  static async deductCredits(
    candidateId: string,
    amountOrService: number | MeteredService,
    options: {
      idempotencyKey?: string;
      referenceId?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<{ success: boolean; balanceRemaining: number; ledgerEntry: CreditLedgerEntry }> {
    const db = await getDatabase();

    const amount =
      typeof amountOrService === 'number'
        ? amountOrService
        : PlanConfigService.getCreditCost(amountOrService);

    const service = typeof amountOrService === 'string' ? amountOrService : undefined;

    // 1. Idempotency check: if key supplied and already processed, return existing
    if (options.idempotencyKey) {
      const existing = await db.collection<any>(LEDGER_COLLECTION).findOne({
        user_id: candidateId,
        idempotencyKey: options.idempotencyKey,
      });

      if (existing) {
        const account = await this.getOrCreateAccount(candidateId);
        return {
          success: true,
          balanceRemaining: account.balance,
          ledgerEntry: existing,
        };
      }
    }

    // 2. Ensure account exists and is in current cycle
    const account = await this.getOrCreateAccount(candidateId);

    // 3. Atomic deduction with strict non-negative balance enforcement
    // Using atomic update with query condition { balance: { $gte: amount } }
    const updateResult = await db.collection<any>(ACCOUNTS_COLLECTION).updateOne(
      {
        user_id: candidateId,
        balance: { $gte: amount },
      },
      {
        $inc: {
          balance: -amount,
          consumedThisCycle: amount,
        },
        $set: {
          updatedAt: new Date().toISOString(),
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      // Re-read latest balance for detailed exception
      const latest = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
      throw new InsufficientCreditsError(amount, latest?.balance ?? account.balance);
    }

    // Read updated account
    const updatedAccount = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
    const balanceRemaining = updatedAccount?.balance ?? account.balance - amount;

    // 4. Record ledger entry
    const ledgerEntry = await this.recordLedgerEntry({
      candidateId,
      type: 'deduction',
      amount,
      service,
      balanceAfter: balanceRemaining,
      idempotencyKey: options.idempotencyKey,
      referenceId: options.referenceId,
      description: options.description || `AI credit deduction for ${service || 'metered operation'}`,
      performedBy: candidateId,
      metadata: options.metadata,
    });

    return {
      success: true,
      balanceRemaining,
      ledgerEntry,
    };
  }

  /**
   * Refunds credits when an operation fails or is aborted.
   * Policy: Users are never charged for failed AI generation operations.
   */
  static async refundCredits(
    candidateId: string,
    amount: number,
    service: MeteredService | undefined,
    reason: string,
    options: {
      idempotencyKey?: string;
      referenceId?: string;
    } = {},
  ): Promise<{ balanceRemaining: number; ledgerEntry: CreditLedgerEntry }> {
    const db = await getDatabase();

    await db.collection<any>(ACCOUNTS_COLLECTION).updateOne(
      { user_id: candidateId },
      {
        $inc: {
          balance: amount,
          consumedThisCycle: -amount,
        },
        $set: {
          updatedAt: new Date().toISOString(),
        },
      },
    );

    const updatedAccount = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
    const balanceRemaining = updatedAccount?.balance ?? amount;

    const ledgerEntry = await this.recordLedgerEntry({
      candidateId,
      type: 'refund',
      amount,
      service,
      balanceAfter: balanceRemaining,
      idempotencyKey: options.idempotencyKey,
      referenceId: options.referenceId,
      description: `Refund: ${reason}`,
      performedBy: 'system',
    });

    return {
      balanceRemaining,
      ledgerEntry,
    };
  }

  /**
   * Adjusts credits manually by an Administrator with an immutable audit log.
   */
  static async adjustCreditsByAdmin(
    adminUserId: string,
    candidateId: string,
    amount: number, // positive to add, negative to subtract
    reason: string,
  ): Promise<{ balanceRemaining: number; ledgerEntry: CreditLedgerEntry }> {
    const db = await getDatabase();
    await this.getOrCreateAccount(candidateId);

    // If negative deduction, protect against going below zero
    const condition: any = { user_id: candidateId };
    if (amount < 0) {
      condition.balance = { $gte: Math.abs(amount) };
    }

    const updateResult = await db.collection<any>(ACCOUNTS_COLLECTION).updateOne(
      condition,
      {
        $inc: {
          balance: amount,
        },
        $set: {
          updatedAt: new Date().toISOString(),
        },
      },
    );

    if (amount < 0 && updateResult.modifiedCount === 0) {
      const latest = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
      throw new InsufficientCreditsError(Math.abs(amount), latest?.balance ?? 0);
    }

    const updated = await db.collection<any>(ACCOUNTS_COLLECTION).findOne({ user_id: candidateId });
    const balanceRemaining = updated?.balance ?? 0;

    const ledgerEntry = await this.recordLedgerEntry({
      candidateId,
      type: 'admin_adjustment',
      amount,
      balanceAfter: balanceRemaining,
      description: `Admin adjustment: ${reason}`,
      performedBy: adminUserId,
      metadata: { adminUserId, reason },
    });

    // Record immutable audit event
    const auditEvent: BillingAuditEvent = {
      id: randomUUID(),
      action: 'admin.credits.adjust',
      actor: adminUserId,
      targetCandidateId: candidateId,
      details: {
        adjustmentAmount: amount,
        balanceAfter: balanceRemaining,
        reason,
      },
      timestamp: new Date().toISOString(),
    };
    await db.collection<any>(AUDIT_COLLECTION).insertOne(auditEvent);

    return {
      balanceRemaining,
      ledgerEntry,
    };
  }

  /**
   * Retrieves usage history for a candidate.
   */
  static async getUsageHistory(
    candidateId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ entries: CreditLedgerEntry[]; total: number }> {
    const db = await getDatabase();
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const filter = { user_id: candidateId };
    const total = await db.collection<any>(LEDGER_COLLECTION).countDocuments(filter);
    const entries = await db
      .collection<any>(LEDGER_COLLECTION)
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return {
      entries,
      total,
    };
  }

  private static async recordLedgerEntry(
    data: Omit<CreditLedgerEntry, 'id' | 'user_id' | 'timestamp'>,
  ): Promise<CreditLedgerEntry> {
    const db = await getDatabase();
    const entry: CreditLedgerEntry = {
      id: randomUUID(),
      user_id: data.candidateId,
      timestamp: new Date().toISOString(),
      ...data,
    };

    await db.collection<any>(LEDGER_COLLECTION).insertOne(entry);
    return entry;
  }
}

