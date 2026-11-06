import { getDatabase } from '../../config/mongodb.js';
import { PlanConfigService } from './planConfig.js';
import { PaymentGatewayService } from './paymentGateway.js';
import type { SubscriptionTier, SubscriptionStatus } from './types.js';

export interface RevenueAnalytics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annualized Run Rate
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  arpu: number; // Average Revenue Per User
  tierBreakdown: Record<SubscriptionTier, { count: number; revenue: number }>;
  recentTransactionsCount: number;
}

export interface UsageAnalytics {
  totalCreditsConsumed: number;
  serviceBreakdown: Record<string, { calls: number; credits: number }>;
  topConsumers: Array<{ candidateId: string; creditsConsumed: number }>;
  activeConsumersCount: number;
}

export interface AbuseAlert {
  candidateId: string;
  candidateEmail?: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  metric: string;
  value: number;
  timestamp: string;
}

export interface SystemHealthOverview {
  gateway: {
    name: string;
    isLiveMode: boolean;
    status: 'operational' | 'degraded';
  };
  database: {
    status: 'connected';
  };
  subscriptions: {
    active: number;
    pastDue: number;
    canceled: number;
  };
  metrics: {
    failedPaymentRate: number; // Percentage 0 - 100
    refundRate: number; // Percentage 0 - 100
  };
}

export class AdminBillingService {
  /**
   * Computes revenue analytics (MRR, ARR, ARPU, net revenue, tier breakdowns).
   */
  static async getRevenueAnalytics(): Promise<RevenueAnalytics> {
    const db = await getDatabase();
    const plans = await PlanConfigService.getPlans();

    // 1. Fetch active subscriptions
    const activeSubs = await db
      .collection<any>('candidate_subscriptions')
      .find({ status: 'active' })
      .toArray();

    let mrr = 0;
    const tierBreakdown: Record<SubscriptionTier, { count: number; revenue: number }> = {
      free: { count: 0, revenue: 0 },
      pro: { count: 0, revenue: 0 },
      premium: { count: 0, revenue: 0 },
    };

    for (const sub of activeSubs) {
      const tier = sub.tier as SubscriptionTier;
      if (tierBreakdown[tier]) {
        tierBreakdown[tier].count++;
        const price = plans[tier]?.price.amount || 0;
        const monthlyContrib = sub.billingInterval === 'year' ? price / 12 : price;
        tierBreakdown[tier].revenue += monthlyContrib;
        mrr += monthlyContrib;
      }
    }

    const arr = mrr * 12;

    // 2. Aggregate transactions
    const transactions = await db.collection<any>('payment_transactions').find().toArray();
    let totalRevenue = 0;
    let totalRefunds = 0;

    for (const tx of transactions) {
      if (tx.status === 'captured') {
        totalRevenue += tx.amount || 0;
      } else if (tx.status === 'refunded') {
        totalRevenue += tx.amount || 0;
        totalRefunds += tx.refundAmount || tx.amount || 0;
      }
    }

    const netRevenue = totalRevenue - totalRefunds;
    const payingUserCount = tierBreakdown.pro.count + tierBreakdown.premium.count;
    const arpu = payingUserCount > 0 ? Math.round((mrr / payingUserCount) * 100) / 100 : 0;

    return {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      totalRevenue: Math.round(totalRevenue),
      totalRefunds: Math.round(totalRefunds),
      netRevenue: Math.round(netRevenue),
      arpu,
      tierBreakdown,
      recentTransactionsCount: transactions.length,
    };
  }

  /**
   * Computes usage analytics for all metered AI services.
   */
  static async getUsageAnalytics(): Promise<UsageAnalytics> {
    const db = await getDatabase();

    const ledgerEntries = await db
      .collection<any>('credit_ledger')
      .find({ type: 'deduction' })
      .toArray();

    let totalCreditsConsumed = 0;
    const serviceBreakdown: Record<string, { calls: number; credits: number }> = {};
    const candidateConsumption: Record<string, number> = {};

    for (const entry of ledgerEntries) {
      const svc = entry.service || 'other';
      const credits = entry.amount || 0;
      totalCreditsConsumed += credits;

      if (!serviceBreakdown[svc]) {
        serviceBreakdown[svc] = { calls: 0, credits: 0 };
      }
      serviceBreakdown[svc].calls++;
      serviceBreakdown[svc].credits += credits;

      candidateConsumption[entry.candidateId] =
        (candidateConsumption[entry.candidateId] || 0) + credits;
    }

    const topConsumers = Object.entries(candidateConsumption)
      .map(([candidateId, creditsConsumed]) => ({ candidateId, creditsConsumed }))
      .sort((a, b) => b.creditsConsumed - a.creditsConsumed)
      .slice(0, 10);

    return {
      totalCreditsConsumed,
      serviceBreakdown,
      topConsumers,
      activeConsumersCount: Object.keys(candidateConsumption).length,
    };
  }

  /**
   * Detects abnormal credit velocity, excessive deductions, and repeated payment failures.
   */
  static async getAbuseMonitoring(): Promise<AbuseAlert[]> {
    const db = await getDatabase();
    const alerts: AbuseAlert[] = [];

    // 1. Detect rapid credit consumption in last 24h (> 300 credits)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentDeductions = await db
      .collection<any>('credit_ledger')
      .find({ type: 'deduction', timestamp: { $gte: yesterday } })
      .toArray();

    const velocityMap: Record<string, number> = {};
    for (const d of recentDeductions) {
      velocityMap[d.candidateId] = (velocityMap[d.candidateId] || 0) + (d.amount || 0);
    }

    for (const [candidateId, consumed] of Object.entries(velocityMap)) {
      if (consumed > 250) {
        alerts.push({
          candidateId,
          severity: consumed > 500 ? 'high' : 'medium',
          reason: 'Abnormal high-velocity credit deduction within 24h',
          metric: '24h Credit Consumption',
          value: consumed,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 2. Detect repeated payment failures (>= 3)
    const failingSubs = await db
      .collection<any>('candidate_subscriptions')
      .find({ failedPaymentCount: { $gte: 2 } })
      .toArray();

    for (const sub of failingSubs) {
      alerts.push({
        candidateId: sub.candidateId,
        severity: sub.failedPaymentCount >= 3 ? 'high' : 'medium',
        reason: 'Multiple consecutive payment transaction failures',
        metric: 'Failed Payment Count',
        value: sub.failedPaymentCount,
        timestamp: sub.lastPaymentFailure?.date || new Date().toISOString(),
      });
    }

    return alerts;
  }

  /**
   * Provides overall system health status for administrative overview.
   */
  static async getSystemHealthOverview(): Promise<SystemHealthOverview> {
    const db = await getDatabase();
    const gateway = PaymentGatewayService.getAdapter();

    const [activeCount, pastDueCount, canceledCount] = await Promise.all([
      db.collection<any>('candidate_subscriptions').countDocuments({ status: 'active' }),
      db.collection<any>('candidate_subscriptions').countDocuments({ status: 'past_due' }),
      db.collection<any>('candidate_subscriptions').countDocuments({ status: 'canceled' }),
    ]);

    const [totalTx, failedTx, refundedTx] = await Promise.all([
      db.collection<any>('payment_transactions').countDocuments(),
      db.collection<any>('payment_transactions').countDocuments({ status: 'failed' }),
      db.collection<any>('payment_transactions').countDocuments({ status: 'refunded' }),
    ]);

    const failedPaymentRate = totalTx > 0 ? Math.round((failedTx / totalTx) * 1000) / 10 : 0;
    const refundRate = totalTx > 0 ? Math.round((refundedTx / totalTx) * 1000) / 10 : 0;

    return {
      gateway: {
        name: gateway.name,
        isLiveMode: gateway.isLiveMode,
        status: 'operational',
      },
      database: {
        status: 'connected',
      },
      subscriptions: {
        active: activeCount,
        pastDue: pastDueCount,
        canceled: canceledCount,
      },
      metrics: {
        failedPaymentRate,
        refundRate,
      },
    };
  }

  /**
   * Lists subscriptions with optional filtering for Admin Portal.
   */
  static async listSubscriptions(params: {
    tier?: SubscriptionTier;
    status?: SubscriptionStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ subscriptions: any[]; total: number }> {
    const db = await getDatabase();
    const filter: any = {};
    if (params.tier) filter.tier = params.tier;
    if (params.status) filter.status = params.status;

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    const total = await db.collection<any>('candidate_subscriptions').countDocuments(filter);
    const subscriptions = await db
      .collection<any>('candidate_subscriptions')
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return { subscriptions, total };
  }

  /**
   * Lists billing audit events.
   */
  static async listAuditLogs(limit = 100): Promise<any[]> {
    const db = await getDatabase();
    return db
      .collection<any>('billing_audit_logs')
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}

