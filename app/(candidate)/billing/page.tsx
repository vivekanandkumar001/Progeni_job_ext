'use client';

import { useEffect, useState } from 'react';
import {
  getBillingPlans,
  getCandidateSubscription,
  getCandidateCredits,
  getCandidateUsage,
  getCandidateInvoices,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  cancelCandidateSubscription,
  type PlanConfigItem,
  type CandidateSubscriptionItem,
  type CandidateCreditAccountItem,
  type CreditLedgerItem,
  type PaymentTransactionItem,
  type SubscriptionTier,
} from '../../../lib/api';

export default function CandidateBillingPage() {
  const [plans, setPlans] = useState<Record<SubscriptionTier, PlanConfigItem> | null>(null);
  const [subscription, setSubscription] = useState<CandidateSubscriptionItem | null>(null);
  const [credits, setCredits] = useState<CandidateCreditAccountItem | null>(null);
  const [usage, setUsage] = useState<CreditLedgerItem[]>([]);
  const [invoices, setInvoices] = useState<PaymentTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'plans' | 'usage' | 'invoices'>('plans');

  // Checkout & Upgrade State
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Cancel Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [canceling, setCanceling] = useState(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransactionItem | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [plansData, subData, creditsData, usageData, invoicesData] = await Promise.all([
        getBillingPlans(),
        getCandidateSubscription(),
        getCandidateCredits(),
        getCandidateUsage({ limit: 30 }),
        getCandidateInvoices({ limit: 20 }),
      ]);

      setPlans(plansData);
      setSubscription(subData.subscription);
      setCredits(creditsData);
      setUsage(usageData.entries || []);
      setInvoices(invoicesData.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing and subscription information.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleUpgrade(targetTier: 'pro' | 'premium') {
    setProcessingTier(targetTier);
    setError('');
    try {
      // 1. Create Order
      const { order } = await createSubscriptionOrder(targetTier, billingInterval);

      // 2. Client Payment Simulation / Gateway Integration
      // In sandbox mode, verify signature immediately with authentic simulated payment ID
      const paymentId = `pay_${Math.random().toString(36).slice(2, 11)}`;
      const signature = `mock_sig_${order.orderId}_${paymentId}`;

      const verifyRes = await verifySubscriptionPayment({
        orderId: order.orderId,
        paymentId,
        signature,
      });

      setNotice(
        `Successfully upgraded to ${targetTier.toUpperCase()}! Your new quota is active immediately.`,
      );
      setSubscription(verifyRes.subscription);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to complete subscription upgrade.');
    } finally {
      setProcessingTier(null);
    }
  }

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      const updated = await cancelCandidateSubscription(cancelReason || 'Candidate cancellation');
      setSubscription(updated);
      setNotice('Auto-renewal canceled. You will continue to have full access until the current period ends.');
      setShowCancelModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription.');
    } finally {
      setCanceling(false);
    }
  }

  const currentTier = subscription?.tier || 'free';
  const creditBalance = credits?.balance ?? 0;
  const monthlyQuota = credits?.monthlyQuota ?? 50;
  const percentageRemaining = monthlyQuota > 0 ? Math.min(100, Math.round((creditBalance / monthlyQuota) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Plans, Credits & Billing</h1>
          <p className="text-sm text-on-surface-variant">
            Manage your subscription tier, track AI service credit consumption, and download invoices.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 bg-surface border border-outline-variant p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ activeTab === 'plans' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-on-surface-variant hover:text-on-surface' }`}
          >
            Subscription Plans
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ activeTab === 'usage' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-on-surface-variant hover:text-on-surface' }`}
          >
            Credit Usage ({usage.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ activeTab === 'invoices' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-on-surface-variant hover:text-on-surface' }`}
          >
            Invoices ({invoices.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-success/10 border border-success/20 text-success text-xs flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-success hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs text-danger hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Cards: Current Subscription Status & Available Credits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Current Plan Card */}
        <div className="p-5 rounded-2xl bg-surface border border-outline-variant space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Active Tier
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ currentTier === 'premium' ? 'bg-primary/20 text-primary border border-primary/30' : currentTier === 'pro' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-subtle text-on-surface-variant' }`}
            >
              {currentTier}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-on-surface capitalize">
              {currentTier === 'free' ? 'Free Starter' : currentTier === 'pro' ? 'Pro Accelerator' : 'Premium Elite'}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Status: <span className="text-success font-semibold uppercase">{subscription?.status || 'ACTIVE'}</span>
            </p>
          </div>

          <div className="pt-2 border-t border-outline-variant text-xs text-on-surface-variant space-y-1">
            {subscription?.currentPeriodEnd && (
              <div className="flex justify-between">
                <span>Current Cycle End:</span>
                <span className="font-mono text-on-surface">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd ? (
              <div className="text-warning font-medium">
                * Cancels at period end
              </div>
            ) : currentTier !== 'free' ? (
              <div className="flex justify-between pt-1">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-xs text-danger hover:underline"
                >
                  Cancel auto-renewal
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Available Credits Card */}
        <div className="p-5 rounded-2xl bg-surface border border-outline-variant space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Available AI Credits
            </span>
            <span className="text-xs text-on-surface-variant">
              Quota: {creditBalance} / {monthlyQuota} credits
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-bold text-on-surface font-mono">
              {creditBalance}
            </div>
            <span className="text-xs text-on-surface-variant">
              credits remaining ({percentageRemaining}% of monthly allocation)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-subtle h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${ percentageRemaining > 50 ? 'bg-purple-500' : percentageRemaining > 20 ? 'bg-amber-500' : 'bg-rose-500' }`}
              style={{ width: `${percentageRemaining}%` }}
            />
          </div>

          {/* Unit costs guide */}
          <div className="pt-2 border-t border-outline-variant grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-on-surface-variant">
            <div>• Tailored Resume: <span className="font-mono text-on-surface">5 cr</span></div>
            <div>• Cover Letter: <span className="font-mono text-on-surface">3 cr</span></div>
            <div>• Question Answer: <span className="font-mono text-on-surface">1 cr</span></div>
            <div>• AI Simulation: <span className="font-mono text-on-surface">10 cr</span></div>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="p-16 text-center text-sm text-on-surface-variant">Loading subscription and credit ledger...</div>
      ) : activeTab === 'plans' ? (
        /* Plans & Upgrade Comparison */
        <div className="space-y-6">
          {/* Interval Selector */}
          <div className="flex justify-center items-center gap-3 py-2">
            <span className={`text-xs ${billingInterval === 'month' ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
              className="relative w-12 h-6 rounded-full bg-surface-subtle border border-outline p-0.5 transition"
            >
              <div
                className={`w-5 h-5 rounded-full bg-purple-500 transition-transform ${ billingInterval === 'year' ? 'translate-x-6' : 'translate-x-0' }`}
              />
            </button>
            <span className={`text-xs flex items-center gap-1.5 ${billingInterval === 'year' ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>
              Yearly Billing
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-success/20 text-success">
                2 MONTHS FREE
              </span>
            </span>
          </div>

          {/* Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['free', 'pro', 'premium'] as const).map((tierKey) => {
              const plan = plans ? plans[tierKey] : null;
              if (!plan) return null;
              const isCurrent = currentTier === tierKey;
              const price =
                billingInterval === 'year'
                  ? Math.round(plan.price.amount * 10)
                  : plan.price.amount;

              return (
                <div
                  key={tierKey}
                  className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 relative transition ${ isCurrent ? 'bg-surface border-primary/30 shadow-soft' : plan.popular ? 'bg-surface border-outline hover:border-outline' : 'bg-surface border-outline-variant' }`}
                >
                  {plan.popular && !isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-primary text-primary-foreground shadow">
                      MOST POPULAR
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-on-surface">{plan.name}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-on-surface">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        / {billingInterval === 'year' ? 'year' : 'month'}
                      </span>
                    </div>

                    {/* Features list */}
                    <div className="space-y-2 pt-2 border-t border-outline-variant">
                      <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider block">
                        Included Features:
                      </span>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-on-surface-variant">
                          <span className="text-primary">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-surface-subtle text-on-surface-variant text-xs font-semibold cursor-not-allowed border border-outline"
                      >
                        ✓ Current Active Plan
                      </button>
                    ) : tierKey === 'free' ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-surface-subtle text-on-surface-variant text-xs font-medium cursor-not-allowed"
                      >
                        Standard Tier
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(tierKey)}
                        disabled={processingTier === tierKey}
                        className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition shadow-md disabled:opacity-50"
                      >
                        {processingTier === tierKey ? 'Processing Order...' : `Upgrade to ${plan.name} →`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'usage' ? (
        /* Usage History */
        <div className="p-5 rounded-2xl bg-surface border border-outline-variant space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Credit Ledger & Deductions</h2>
            <span className="text-xs text-on-surface-variant">Chronological AI Activity</span>
          </div>

          {usage.length === 0 ? (
            <p className="text-xs text-on-surface-variant p-8 text-center">No metered operations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th className="pb-3 font-medium">Activity</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Credits</th>
                    <th className="pb-3 font-medium">Balance After</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {usage.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-subtle">
                      <td className="py-3 text-on-surface font-medium">
                        {entry.description}
                        {entry.service && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-surface-subtle text-primary">
                            {entry.service}
                          </span>
                        )}
                      </td>
                      <td className="py-3 capitalize text-on-surface-variant">{entry.type}</td>
                      <td className="py-3 font-mono font-bold">
                        {entry.type === 'deduction' ? (
                          <span className="text-danger">-{entry.amount}</span>
                        ) : (
                          <span className="text-success">+{entry.amount}</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-on-surface-variant">{entry.balanceAfter} cr</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Invoices & Transactions */
        <div className="p-5 rounded-2xl bg-surface border border-outline-variant space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Payment Transactions & Receipts</h2>
            <span className="text-xs text-on-surface-variant">India Gateway (INR / UPI / Cards)</span>
          </div>

          {invoices.length === 0 ? (
            <p className="text-xs text-on-surface-variant p-8 text-center">No payment transactions recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant text-on-surface-variant">
                    <th className="pb-3 font-medium">Invoice Number</th>
                    <th className="pb-3 font-medium">Plan Tier</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface-subtle">
                      <td className="py-3 font-mono font-semibold text-primary">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 uppercase text-on-surface-variant font-medium">{inv.tier}</td>
                      <td className="py-3 font-mono text-on-surface font-bold">
                        ₹{inv.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ inv.status === 'captured' ? 'bg-success/10 text-success border border-success/20' : inv.status === 'refunded' ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-danger/10 text-danger border border-danger/20' }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedReceipt(inv)}
                          className="text-xs text-primary hover:text-primary underline font-medium"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: View Receipt */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="text-base font-bold text-on-surface">Payment Receipt</h3>
                <p className="text-xs font-mono text-primary">{selectedReceipt.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-on-surface-variant">
                <span>Date:</span>
                <span className="text-on-surface">{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Item:</span>
                <span className="text-on-surface uppercase font-semibold">{selectedReceipt.tier} Plan Subscription</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Payment Reference:</span>
                <span className="font-mono text-on-surface-variant">{selectedReceipt.paymentId}</span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold text-success text-sm">
                  ₹{selectedReceipt.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-on-surface-variant">
                <span>Status:</span>
                <span className="font-bold text-success uppercase">{selectedReceipt.status}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-outline-variant flex justify-end">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-xl bg-surface-subtle text-on-surface text-xs font-medium hover:bg-surface-variant"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Subscription */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full p-6 space-y-4 shadow-card">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-base font-bold text-on-surface">Cancel Auto-Renewal</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Are you sure you want to cancel auto-renewal? You will retain access to your plan features and remaining AI credits until the end of your billing cycle on{' '}
              <strong className="text-on-surface">
                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'period end'}
              </strong>
              .
            </p>

            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Reason for cancellation (optional):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Help us improve: what could we do better?"
                className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-subtle text-on-surface-variant text-xs font-medium hover:bg-surface-variant"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="px-4 py-2 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {canceling ? 'Canceling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

