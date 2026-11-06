import { Request, Response, NextFunction } from 'express';
import { AdminBillingService } from '../services/billing/adminBillingService.js';
import { UsageCreditEngine } from '../services/billing/usageCreditEngine.js';
import { SubscriptionService } from '../services/billing/subscriptionService.js';
import { PaymentGatewayService } from '../services/billing/paymentGateway.js';
import type { AuthRequest } from '../middlewares/auth.js';
import type { SubscriptionTier, SubscriptionStatus } from '../services/billing/types.js';

export async function getBillingOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const analytics = await AdminBillingService.getRevenueAnalytics();
    res.json({ ok: true, analytics });
  } catch (err) {
    next(err);
  }
}

export async function getUsageAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usage = await AdminBillingService.getUsageAnalytics();
    res.json({ ok: true, usage });
  } catch (err) {
    next(err);
  }
}

export async function listSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tier = req.query.tier as SubscriptionTier | undefined;
    const status = req.query.status as SubscriptionStatus | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const data = await AdminBillingService.listSubscriptions({ tier, status, limit, offset });
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function adminCancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const candidateId = req.params.candidateId;
    const { reason, immediate } = req.body;

    const sub = await SubscriptionService.cancelSubscription(
      candidateId,
      reason || 'Administrative cancellation',
      Boolean(immediate),
    );

    res.json({ ok: true, subscription: sub });
  } catch (err) {
    next(err);
  }
}

export async function listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const candidateId = req.query.candidateId as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    if (candidateId) {
      const data = await PaymentGatewayService.listCandidateTransactions(candidateId, { limit, offset });
      res.json({ ok: true, ...data });
      return;
    }

    const { getDatabase } = await import('../config/mongodb.js');
    const db = await getDatabase();
    const total = await db.collection<any>('payment_transactions').countDocuments();
    const transactions = await db
      .collection<any>('payment_transactions')
      .find()
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    res.json({ ok: true, transactions, total });
  } catch (err) {
    next(err);
  }
}

export async function issueRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const adminId = authReq.userId || 'admin_system';
    const transactionId = req.params.transactionId;
    const { amount, reason } = req.body;

    const transaction = await PaymentGatewayService.processRefund({
      transactionId,
      amount: amount ? Number(amount) : undefined,
      reason,
      adminId,
    });

    res.json({ ok: true, transaction });
  } catch (err) {
    next(err);
  }
}

export async function adjustCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const adminId = authReq.userId || 'admin_system';
    const { candidateId, amount, reason } = req.body;

    if (!candidateId || typeof amount !== 'number' || !reason) {
      res.status(400).json({ ok: false, error: 'candidateId, numeric amount, and reason are required' });
      return;
    }

    const result = await UsageCreditEngine.adjustCreditsByAdmin(
      adminId,
      candidateId,
      amount,
      reason,
    );

    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getAbuseMonitoring(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await AdminBillingService.getAbuseMonitoring();
    res.json({ ok: true, alerts });
  } catch (err) {
    next(err);
  }
}

export async function getSystemHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const health = await AdminBillingService.getSystemHealthOverview();
    res.json({ ok: true, health });
  } catch (err) {
    next(err);
  }
}

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const logs = await AdminBillingService.listAuditLogs(limit);
    res.json({ ok: true, logs });
  } catch (err) {
    next(err);
  }
}

