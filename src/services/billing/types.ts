export type SubscriptionTier = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type BillingInterval = 'month' | 'year';

export interface PlanQuotas {
  resumeGenerations: number;
  coverLetters: number;
  screeningAnswers: number;
  jobMatches: number;
  interviewSimulations: number;
  totalAiCredits: number;
}

export interface PlanConfig {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: {
    amount: number; // e.g. 999 for INR or 12 for USD
    currency: 'INR' | 'USD';
    interval: BillingInterval;
  };
  features: string[];
  quotas: PlanQuotas;
  popular?: boolean;
}

export type MeteredService =
  | 'resume_generation'
  | 'cover_letter'
  | 'screening_answer'
  | 'job_match'
  | 'interview_simulation'
  | 'custom_ai';

export interface CandidateSubscription {
  id: string;
  candidateId: string;
  user_id: string; // for MongoDB multi-tenant indexing
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string;
  cancelReason?: string;
  gatewaySubscriptionId?: string;
  gatewayCustomerId?: string;
  failedPaymentCount: number;
  lastPaymentFailure?: {
    date: string;
    reason: string;
    invoiceId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CandidateCreditAccount {
  id: string;
  candidateId: string;
  user_id: string;
  tier: SubscriptionTier;
  balance: number; // spendable credits
  monthlyQuota: number; // allocated monthly quota
  consumedThisCycle: number; // consumed this billing period
  billingCycleStart: string;
  billingCycleEnd: string;
  updatedAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  candidateId: string;
  user_id: string;
  type: 'grant' | 'deduction' | 'refund' | 'admin_adjustment';
  amount: number;
  service?: MeteredService;
  balanceAfter: number;
  idempotencyKey?: string;
  referenceId?: string;
  description: string;
  performedBy: string; // candidate ID, admin ID, or 'system'
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentOrder {
  id: string;
  orderId: string;
  candidateId: string;
  user_id: string;
  tier: SubscriptionTier;
  interval: BillingInterval;
  amount: number; // In currency units (e.g. 999)
  currency: 'INR' | 'USD';
  status: 'created' | 'attempted' | 'paid' | 'failed';
  gateway: string;
  createdAt: string;
  expiresAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  paymentId: string;
  candidateId: string;
  user_id: string;
  amount: number;
  currency: 'INR' | 'USD';
  tier: SubscriptionTier;
  interval: BillingInterval;
  gateway: string;
  status: 'captured' | 'failed' | 'refunded';
  method?: string;
  invoiceNumber: string;
  receiptUrl?: string;
  errorMessage?: string;
  refundId?: string;
  refundAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingAuditEvent {
  id: string;
  action: string;
  actor: string;
  targetCandidateId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

