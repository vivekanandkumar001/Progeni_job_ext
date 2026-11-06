import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { getDatabase } from '../../config/mongodb.js';
import type {
  PaymentOrder,
  PaymentTransaction,
  SubscriptionTier,
  BillingInterval,
} from './types.js';

const TRANSACTIONS_COLLECTION = 'payment_transactions';
const ORDERS_COLLECTION = 'payment_orders';

export interface CreateOrderInput {
  candidateId: string;
  tier: SubscriptionTier;
  interval: BillingInterval;
  amount: number; // in INR
  currency?: 'INR' | 'USD';
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
  candidateId: string;
}

export interface RefundInput {
  transactionId: string;
  amount?: number;
  reason?: string;
  adminId: string;
}

export interface PaymentGatewayAdapter {
  readonly name: string;
  readonly isLiveMode: boolean;

  createGatewayOrder(params: {
    orderId: string;
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ gatewayOrderId: string }>;

  verifyGatewayPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;

  verifyWebhookSignature(payload: string, signature: string): boolean;

  executeRefund(params: {
    paymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: 'processed' | 'pending' | 'failed' }>;
}

/**
 * Razorpay Payment Gateway Adapter (Standard for India SaaS / UPI / NetBanking / Cards)
 * Defaults to safe sandbox/test mode unless explicitly configured with verified production credentials.
 */
export class RazorpayPaymentGateway implements PaymentGatewayAdapter {
  public readonly name = 'razorpay';
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  public readonly isLiveMode: boolean;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_autoapply_sandbox';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'sandbox_secret_autoapply_2026';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'sandbox_webhook_secret_2026';

    // Strictly enforce sandbox mode unless explicitly verified production configuration is active
    this.isLiveMode =
      process.env.NODE_ENV === 'production' &&
      Boolean(process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')) &&
      Boolean(process.env.ENABLE_LIVE_PAYMENTS === 'true');
  }

  async createGatewayOrder(params: {
    orderId: string;
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ gatewayOrderId: string }> {
    if (this.isLiveMode) {
      // In production mode with live credentials, invoke Razorpay Orders API
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100), // Razorpay accepts amounts in paise
          currency: params.currency,
          receipt: params.receipt,
          notes: params.notes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`Razorpay order creation failed: ${(errData as any).error?.description || res.statusText}`);
      }

      const data = (await res.json()) as { id: string };
      return { gatewayOrderId: data.id };
    }

    // High-fidelity sandbox / test mode order generation
    const mockGatewayOrderId = `order_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    return { gatewayOrderId: mockGatewayOrderId };
  }

  verifyGatewayPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    if (!params.orderId || !params.paymentId || !params.signature) {
      return false;
    }

    // Razorpay signature formula: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const payload = `${params.orderId}|${params.paymentId}`;
    const expected = createHmac('sha256', this.keySecret).update(payload).digest('hex');

    const sigBuf = Buffer.from(params.signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      // In sandbox mode, allow mock test signature if matches mock pattern
      if (!this.isLiveMode && params.signature === `mock_sig_${params.orderId}_${params.paymentId}`) {
        return true;
      }
      return false;
    }

    return timingSafeEqual(sigBuf, expBuf);
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!payload || !signature) return false;

    const expected = createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      if (!this.isLiveMode && signature === 'mock_test_webhook_signature') {
        return true;
      }
      return false;
    }

    return timingSafeEqual(sigBuf, expBuf);
  }

  async executeRefund(params: {
    paymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; status: 'processed' | 'pending' | 'failed' }> {
    if (this.isLiveMode) {
      const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${params.paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(params.amount * 100),
          notes: { reason: params.reason || 'Customer requested refund' },
        }),
      });

      if (!res.ok) {
        throw new Error(`Razorpay refund failed: ${res.statusText}`);
      }

      const data = (await res.json()) as { id: string; status: string };
      return {
        refundId: data.id,
        status: data.status === 'processed' ? 'processed' : 'pending',
      };
    }

    // High-fidelity sandbox refund
    return {
      refundId: `rfnd_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      status: 'processed',
    };
  }
}

export class PaymentGatewayService {
  private static adapter: PaymentGatewayAdapter = new RazorpayPaymentGateway();

  static setAdapter(adapter: PaymentGatewayAdapter): void {
    this.adapter = adapter;
  }

  static getAdapter(): PaymentGatewayAdapter {
    return this.adapter;
  }

  /**
   * Initializes a payment order for subscription upgrade or renewal.
   */
  static async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    const db = await getDatabase();
    const orderId = `ord_${randomUUID().slice(0, 12)}`;
    const currency = input.currency || 'INR';

    const gatewayRes = await this.adapter.createGatewayOrder({
      orderId,
      amount: input.amount,
      currency,
      receipt: `rcpt_${orderId}`,
      notes: {
        candidateId: input.candidateId,
        tier: input.tier,
        interval: input.interval,
      },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 min order validity

    const orderDoc: PaymentOrder = {
      id: orderId,
      orderId: gatewayRes.gatewayOrderId || orderId,
      candidateId: input.candidateId,
      user_id: input.candidateId,
      tier: input.tier,
      interval: input.interval,
      amount: input.amount,
      currency,
      status: 'created',
      gateway: this.adapter.name,
      createdAt: now.toISOString(),
      expiresAt,
    };

    await db.collection<any>(ORDERS_COLLECTION).insertOne(orderDoc);
    return orderDoc;
  }

  /**
   * Verifies client-submitted payment proof and captures transaction idempotently.
   */
  static async verifyAndCapturePayment(
    input: VerifyPaymentInput,
  ): Promise<{ success: boolean; transaction: PaymentTransaction }> {
    const db = await getDatabase();

    // 1. Idempotency Check: if paymentId already processed, return existing transaction
    const existing = await db.collection<any>(TRANSACTIONS_COLLECTION).findOne({
      paymentId: input.paymentId,
    });

    if (existing) {
      return {
        success: existing.status === 'captured',
        transaction: existing,
      };
    }

    // 2. Fetch Order
    const order = await db.collection<any>(ORDERS_COLLECTION).findOne({
      $or: [{ id: input.orderId }, { orderId: input.orderId }],
      user_id: input.candidateId,
    });

    if (!order) {
      throw new Error(`Payment order ${input.orderId} not found or unauthorized`);
    }

    // 3. Cryptographic Signature Verification
    const isSignatureValid = this.adapter.verifyGatewayPaymentSignature({
      orderId: order.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    });

    if (!isSignatureValid) {
      throw new Error('Invalid payment signature. Payment verification failed.');
    }

    // 4. Record Authoritative Transaction & Invoice
    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const transaction: PaymentTransaction = {
      id: randomUUID(),
      orderId: order.orderId,
      paymentId: input.paymentId,
      candidateId: input.candidateId,
      user_id: input.candidateId,
      amount: order.amount,
      currency: order.currency,
      tier: order.tier,
      interval: order.interval,
      gateway: this.adapter.name,
      status: 'captured',
      invoiceNumber,
      receiptUrl: `/api/v1/billing/invoices/${invoiceNumber}/receipt`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.collection<any>(TRANSACTIONS_COLLECTION).insertOne(transaction);

    // Update order status
    await db.collection<any>(ORDERS_COLLECTION).updateOne(
      { _id: order._id },
      { $set: { status: 'paid', updatedAt: now.toISOString() } },
    );

    return {
      success: true,
      transaction,
    };
  }

  /**
   * Processes a refund for an existing captured transaction.
   */
  static async processRefund(input: RefundInput): Promise<PaymentTransaction> {
    const db = await getDatabase();

    const transaction = await db.collection<any>(TRANSACTIONS_COLLECTION).findOne({
      $or: [{ id: input.transactionId }, { paymentId: input.transactionId }],
    });

    if (!transaction) {
      throw new Error(`Transaction ${input.transactionId} not found`);
    }

    if (transaction.status === 'refunded') {
      throw new Error(`Transaction ${input.transactionId} has already been refunded`);
    }

    const refundAmount = input.amount || transaction.amount;
    const refundRes = await this.adapter.executeRefund({
      paymentId: transaction.paymentId,
      amount: refundAmount,
      reason: input.reason,
    });

    const now = new Date().toISOString();
    await db.collection<any>(TRANSACTIONS_COLLECTION).updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: 'refunded',
          refundId: refundRes.refundId,
          refundAmount,
          updatedAt: now,
        },
      },
    );

    // Audit Event
    await db.collection<any>('billing_audit_logs').insertOne({
      id: randomUUID(),
      action: 'billing.refund.processed',
      actor: input.adminId,
      targetCandidateId: transaction.candidateId,
      details: {
        transactionId: transaction.id,
        paymentId: transaction.paymentId,
        refundId: refundRes.refundId,
        amount: refundAmount,
        reason: input.reason,
      },
      timestamp: now,
    });

    const updated = await db.collection<any>(TRANSACTIONS_COLLECTION).findOne({ _id: transaction._id });
    return updated!;
  }

  /**
   * Lists transaction history for a candidate with pagination.
   */
  static async listCandidateTransactions(
    candidateId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    const db = await getDatabase();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const filter = { user_id: candidateId };
    const total = await db.collection<any>(TRANSACTIONS_COLLECTION).countDocuments(filter);
    const transactions = await db
      .collection<any>(TRANSACTIONS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return { transactions, total };
  }
}

