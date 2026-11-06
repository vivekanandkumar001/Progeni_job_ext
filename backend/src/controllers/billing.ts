import { Request, Response, NextFunction } from 'express';
import { PlanConfigService } from '../services/billing/planConfig.js';
import { SubscriptionService } from '../services/billing/subscriptionService.js';
import { UsageCreditEngine } from '../services/billing/usageCreditEngine.js';
import { PaymentGatewayService } from '../services/billing/paymentGateway.js';
import type { AuthRequest } from '../middlewares/auth.js';
import type { SubscriptionTier, BillingInterval } from '../services/billing/types.js';

export async function getPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plans = await PlanConfigService.getPlans();
    res.json({ ok: true, plans });
  } catch (err) {
    next(err);
  }
}

export async function getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const subscription = await SubscriptionService.getOrCreateSubscription(candidateId);
    const plan = await PlanConfigService.getPlan(subscription.tier);
    const history = await SubscriptionService.getSubscriptionHistory(candidateId);

    res.json({
      ok: true,
      subscription,
      plan,
      history,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCredits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const account = await UsageCreditEngine.getOrCreateAccount(candidateId);
    res.json({ ok: true, account });
  } catch (err) {
    next(err);
  }
}

export async function getUsageHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const data = await UsageCreditEngine.getUsageHistory(candidateId, { limit, offset });
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const { tier, interval } = req.body as {
      tier: SubscriptionTier;
      interval?: BillingInterval;
    };

    if (!tier || (tier !== 'pro' && tier !== 'premium')) {
      res.status(400).json({ ok: false, error: 'Invalid plan tier requested' });
      return;
    }

    const selectedInterval = interval === 'year' ? 'year' : 'month';
    const plan = await PlanConfigService.getPlan(tier);
    const amount = selectedInterval === 'year' ? plan.price.amount * 10 : plan.price.amount; // 2 months free on yearly

    const order = await PaymentGatewayService.createOrder({
      candidateId,
      tier,
      interval: selectedInterval,
      amount,
      currency: plan.price.currency,
    });

    res.json({ ok: true, order });
  } catch (err) {
    next(err);
  }
}

export async function verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const { orderId, paymentId, signature } = req.body;
    if (!orderId || !paymentId || !signature) {
      res.status(400).json({ ok: false, error: 'Missing required payment verification parameters' });
      return;
    }

    // 1. Verify payment signature with Gateway
    const captureResult = await PaymentGatewayService.verifyAndCapturePayment({
      orderId,
      paymentId,
      signature,
      candidateId,
    });

    // 2. Upgrade candidate subscription immediately
    const updatedSub = await SubscriptionService.upgradeSubscription(
      candidateId,
      captureResult.transaction.tier,
      captureResult.transaction.interval,
      captureResult.transaction.paymentId,
    );

    res.json({
      ok: true,
      subscription: updatedSub,
      transaction: captureResult.transaction,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const { reason, immediate } = req.body;
    const updated = await SubscriptionService.cancelSubscription(
      candidateId,
      reason,
      Boolean(immediate),
    );

    res.json({ ok: true, subscription: updated });
  } catch (err) {
    next(err);
  }
}

export async function getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const offset = Number(req.query.offset) || 0;

    const data = await PaymentGatewayService.listCandidateTransactions(candidateId, {
      limit,
      offset,
    });

    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const candidateId = authReq.userId;
    if (!candidateId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }
    const invoiceNumber = req.params.invoiceNumber;

    const data = await PaymentGatewayService.listCandidateTransactions(candidateId, { limit: 100 });
    const match = data.transactions.find((tx) => tx.invoiceNumber === invoiceNumber);

    if (!match) {
      res.status(404).json({ ok: false, error: 'Invoice not found or unauthorized' });
      return;
    }

    res.json({
      ok: true,
      receipt: {
        invoiceNumber: match.invoiceNumber,
        candidateId: match.candidateId,
        date: match.createdAt,
        tier: match.tier,
        amount: match.amount,
        currency: match.currency,
        status: match.status,
        paymentId: match.paymentId,
        gateway: match.gateway,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function handlePaymentWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawPayload = JSON.stringify(req.body);

    const gateway = PaymentGatewayService.getAdapter();
    const isValid = gateway.verifyWebhookSignature(rawPayload, signature);

    if (!isValid) {
      res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured') {
      const payment = payload?.payment?.entity;
      if (payment?.notes?.candidateId) {
        await SubscriptionService.renewSubscription(payment.notes.candidateId, payment.id);
      }
    } else if (event === 'payment.failed') {
      const payment = payload?.payment?.entity;
      if (payment?.notes?.candidateId) {
        await SubscriptionService.handlePaymentFailure(
          payment.notes.candidateId,
          payment.id,
          payment.error_description,
        );
      }
    }

    res.json({ status: 'ok', received: true });
  } catch (err) {
    next(err);
  }
}
