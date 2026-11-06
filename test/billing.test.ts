process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Setup High-Fidelity In-Memory MongoDB Stub
const inMemoryStore = new Map<string, any[]>();

function getCollectionData(name: string): any[] {
  let col = inMemoryStore.get(name);
  if (!col) {
    col = [];
    inMemoryStore.set(name, col);
  }
  return col;
}

function matchesFilter(doc: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const orMatched = expected.some((f) => matchesFilter(doc, f));
      if (!orMatched) return false;
      continue;
    }
    if (expected && typeof expected === 'object') {
      if ('$gte' in expected) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        if (typeof val !== 'number' || val < (expected as any).$gte) return false;
        continue;
      }
      if ('$in' in expected && Array.isArray((expected as any).$in)) {
        const val = key.includes('.')
          ? key.split('.').reduce((acc, part) => acc?.[part], doc)
          : doc[key];
        if (!(expected as any).$in.includes(val)) return false;
        continue;
      }
    }
    const val = key.includes('.')
      ? key.split('.').reduce((acc, part) => acc?.[part], doc)
      : doc[key];
    if (val !== expected) return false;
  }
  return true;
}

function applyUpdate(doc: any, update: any): void {
  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      doc[key] = (doc[key] || 0) + Number(val);
    }
  }
  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = doc;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = val;
      } else {
        doc[key] = val;
      }
    }
  }
}

const mockDb: any = {
  collection(name: string) {
    const col = getCollectionData(name);
    return {
      async insertOne(doc: any) {
        const item = JSON.parse(JSON.stringify(doc));
        if (!item._id) item._id = randomUUID();
        col.push(item);
        return { acknowledged: true, insertedId: item._id };
      },
      async findOne(filter: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        return match ? JSON.parse(JSON.stringify(match)) : null;
      },
      async updateOne(filter: any, update: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (!match) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(match, update);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort() {
            return this;
          },
          skip(n: number) {
            results = results.slice(n);
            return this;
          },
          limit(n: number) {
            results = results.slice(0, n);
            return this;
          },
          async toArray() {
            return JSON.parse(JSON.stringify(results));
          },
        };
      },
    };
  },
};

(globalThis as any).progeniMongoDb = Promise.resolve(mockDb);

import { PlanConfigService } from '../src/services/billing/planConfig.js';
import { UsageCreditEngine, InsufficientCreditsError } from '../src/services/billing/usageCreditEngine.js';
import { SubscriptionService } from '../src/services/billing/subscriptionService.js';
import { PaymentGatewayService } from '../src/services/billing/paymentGateway.js';
import { AdminBillingService } from '../src/services/billing/adminBillingService.js';

test('Phase 9 — SaaS Administration, Billing & Usage Management Subsystem', async (t) => {
  const candidateA = `cand_a_${randomUUID().slice(0, 8)}`;
  const candidateB = `cand_b_${randomUUID().slice(0, 8)}`;
  const adminId = `admin_${randomUUID().slice(0, 8)}`;

  await t.test('1. Plan Configuration: Configurable pricing & quotas (No hardcoded values)', async () => {
    const plans = await PlanConfigService.getPlans();
    assert.ok(plans.free);
    assert.ok(plans.pro);
    assert.ok(plans.premium);

    assert.equal(plans.free.price.amount, 0);
    assert.equal(plans.pro.price.amount, 999);
    assert.equal(plans.premium.price.amount, 2499);

    assert.equal(plans.free.quotas.totalAiCredits, 50);
    assert.equal(plans.pro.quotas.totalAiCredits, 500);
    assert.equal(plans.premium.quotas.totalAiCredits, 2500);

    // Verify unit service costs
    assert.equal(PlanConfigService.getCreditCost('resume_generation'), 5);
    assert.equal(PlanConfigService.getCreditCost('cover_letter'), 3);
    assert.equal(PlanConfigService.getCreditCost('screening_answer'), 1);
    assert.equal(PlanConfigService.getCreditCost('interview_simulation'), 10);
  });

  await t.test('2. Subscription Lifecycle: Initial Free creation, Upgrade, Cancellation, & Renewal', async () => {
    // A. Automatic initialization to Free tier
    const sub = await SubscriptionService.getOrCreateSubscription(candidateA);
    assert.equal(sub.candidateId, candidateA);
    assert.equal(sub.tier, 'free');
    assert.equal(sub.status, 'active');

    // Credit account initialized with Free quota
    const account = await UsageCreditEngine.getOrCreateAccount(candidateA);
    assert.equal(account.balance, 50);
    assert.equal(account.monthlyQuota, 50);

    // B. Upgrade to Pro upon payment
    const upgraded = await SubscriptionService.upgradeSubscription(candidateA, 'pro', 'month', 'pay_test_01');
    assert.equal(upgraded.tier, 'pro');
    assert.equal(upgraded.status, 'active');

    const upgradedAccount = await UsageCreditEngine.getOrCreateAccount(candidateA);
    assert.equal(upgradedAccount.balance, 500);
    assert.equal(upgradedAccount.monthlyQuota, 500);

    // C. Cancel at period end
    const canceled = await SubscriptionService.cancelSubscription(candidateA, 'Moving to another role', false);
    assert.equal(canceled.cancelAtPeriodEnd, true);
    assert.equal(canceled.status, 'active'); // Remains active until period end

    // D. Renew subscription
    const renewed = await SubscriptionService.renewSubscription(candidateA, 'pay_test_renewal');
    assert.equal(renewed.status, 'active');
    assert.equal(renewed.cancelAtPeriodEnd, false);

    // Verify history events were recorded
    const history = await SubscriptionService.getSubscriptionHistory(candidateA);
    assert.ok(history.length >= 3);
    assert.ok(history.some((h) => h.eventType === 'upgraded'));
    assert.ok(history.some((h) => h.eventType === 'canceled'));
    assert.ok(history.some((h) => h.eventType === 'renewed'));
  });

  await t.test('3. Usage & Credit Engine: Server-side atomic deduction, race condition guard, & refund policy', async () => {
    // Candidate starts with 500 credits from Pro tier
    const deductionResult = await UsageCreditEngine.deductCredits(candidateA, 'resume_generation', {
      referenceId: 'res_123',
      description: 'AI resume tailoring',
    });

    assert.equal(deductionResult.success, true);
    assert.equal(deductionResult.balanceRemaining, 495); // 500 - 5
    assert.equal(deductionResult.ledgerEntry.amount, 5);

    // Idempotent deduction with duplicate key prevents double charging
    const idempotencyKey = `deduct_test_${randomUUID()}`;
    const firstCall = await UsageCreditEngine.deductCredits(candidateA, 'cover_letter', {
      idempotencyKey,
      description: 'Idempotent cover letter generation',
    });
    assert.equal(firstCall.balanceRemaining, 492); // 495 - 3

    const secondCall = await UsageCreditEngine.deductCredits(candidateA, 'cover_letter', {
      idempotencyKey,
      description: 'Duplicate replay call',
    });
    // Balance must NOT decrease on duplicate key
    assert.equal(secondCall.balanceRemaining, 492);
    assert.equal(secondCall.ledgerEntry.id, firstCall.ledgerEntry.id);

    // Policy: Refund credits on aborted/failed generation
    const refundRes = await UsageCreditEngine.refundCredits(
      candidateA,
      3,
      'cover_letter',
      'API model timeout during generation',
    );
    assert.equal(refundRes.balanceRemaining, 495); // Restored 492 + 3

    // Negative Balance Guard: Attempt to deduct more than balance
    await assert.rejects(
      () => UsageCreditEngine.deductCredits(candidateA, 1000, { description: 'Exorbitant deduction' }),
      InsufficientCreditsError,
    );
  });

  await t.test('4. Concurrent Credit Deductions: Protects against race conditions and negative balances', async () => {
    // Setup candidate B with exactly 20 credits
    const accountB = await UsageCreditEngine.getOrCreateAccount(candidateB, 'free');
    // Set balance to exactly 20 credits
    await mockDb.collection('candidate_credit_accounts').updateOne(
      { user_id: candidateB },
      { $set: { balance: 20 } },
    );

    // Attempt 5 concurrent deductions of 5 credits each (Total requested: 25, available: 20)
    // Exactly 4 must succeed, and 1 must be rejected with InsufficientCreditsError. Balance must be 0.
    const promises = Array.from({ length: 5 }, (_, i) =>
      UsageCreditEngine.deductCredits(candidateB, 5, {
        description: `Concurrent task ${i}`,
      }).then(
        () => ({ ok: true }),
        (err) => ({ ok: false, error: err }),
      ),
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.filter((r) => !r.ok).length;

    assert.equal(successCount, 4);
    assert.equal(failureCount, 1);

    const finalAccountB = await mockDb.collection('candidate_credit_accounts').findOne({ user_id: candidateB });
    assert.equal(finalAccountB.balance, 0); // Strictly clamped, never negative!
  });

  await t.test('5. Payment Gateway: Order creation, cryptographic verification, & refund processing', async () => {
    // A. Create Order
    const order = await PaymentGatewayService.createOrder({
      candidateId: candidateA,
      tier: 'premium',
      interval: 'month',
      amount: 2499,
      currency: 'INR',
    });

    assert.ok(order.orderId);
    assert.equal(order.amount, 2499);
    assert.equal(order.currency, 'INR');
    assert.equal(order.status, 'created');

    // B. Verify Payment with authentic sandbox signature
    const paymentId = `pay_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const validSignature = `mock_sig_${order.orderId}_${paymentId}`;

    const captureResult = await PaymentGatewayService.verifyAndCapturePayment({
      orderId: order.orderId,
      paymentId,
      signature: validSignature,
      candidateId: candidateA,
    });

    assert.equal(captureResult.success, true);
    assert.equal(captureResult.transaction.status, 'captured');
    assert.ok(captureResult.transaction.invoiceNumber.startsWith('INV-'));

    // C. Tampered Signature Rejection
    await assert.rejects(
      () =>
        PaymentGatewayService.verifyAndCapturePayment({
          orderId: order.orderId,
          paymentId: `pay_forged_${randomUUID().slice(0, 6)}`,
          signature: 'forged_invalid_signature',
          candidateId: candidateA,
        }),
      /Invalid payment signature/,
    );

    // D. Process Refund
    const refundTx = await PaymentGatewayService.processRefund({
      transactionId: captureResult.transaction.id,
      amount: 2499,
      reason: 'Accidental double payment refund request',
      adminId,
    });

    assert.equal(refundTx.status, 'refunded');
    assert.ok(refundTx.refundId);
    assert.equal(refundTx.refundAmount, 2499);
  });

  await t.test('6. Admin Dashboard & Analytics: Revenue metrics, usage aggregation, & manual adjustments', async () => {
    // A. Revenue Analytics
    const rev = await AdminBillingService.getRevenueAnalytics();
    assert.ok(rev.mrr >= 0);
    assert.ok(rev.totalRevenue >= 0);
    assert.ok(rev.totalRefunds >= 0);

    // B. Usage Analytics
    const usage = await AdminBillingService.getUsageAnalytics();
    assert.ok(usage.totalCreditsConsumed > 0);
    assert.ok(usage.serviceBreakdown['resume_generation']);

    // C. Admin Manual Credit Adjustment with Audit Trail
    const adjustResult = await UsageCreditEngine.adjustCreditsByAdmin(
      adminId,
      candidateA,
      100,
      'Loyalty bonus granted by support team',
    );
    assert.ok(adjustResult.balanceRemaining > 0);

    // Verify audit log was recorded
    const auditLogs = await AdminBillingService.listAuditLogs(10);
    const hasAdjustAudit = auditLogs.some(
      (log) => log.action === 'admin.credits.adjust' && log.actor === adminId,
    );
    assert.equal(hasAdjustAudit, true);

    // D. System Health Overview
    const health = await AdminBillingService.getSystemHealthOverview();
    assert.equal(health.gateway.name, 'razorpay');
    assert.equal(health.database.status, 'connected');
    assert.ok(typeof health.metrics.failedPaymentRate === 'number');
  });

  await t.test('7. Multi-Tenant IDOR Security Defense: Candidate B blocked from Candidate A records', async () => {
    // Candidate B cannot verify payment for Candidate A order
    const orderA = await PaymentGatewayService.createOrder({
      candidateId: candidateA,
      tier: 'pro',
      interval: 'month',
      amount: 999,
    });

    await assert.rejects(
      () =>
        PaymentGatewayService.verifyAndCapturePayment({
          orderId: orderA.orderId,
          paymentId: 'pay_hijack_attempt',
          signature: `mock_sig_${orderA.orderId}_pay_hijack_attempt`,
          candidateId: candidateB, // IDOR attack
        }),
      /not found or unauthorized/,
    );

    // Candidate B invoice listing returns strictly 0 records
    const bInvoices = await PaymentGatewayService.listCandidateTransactions(candidateB);
    assert.equal(bInvoices.total, 0);
  });
});

