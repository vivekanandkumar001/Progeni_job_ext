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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Plans, Credits & Billing</h1>
          <p className="text-sm text-zinc-400">
            Manage your subscription tier, track AI service credit consumption, and download invoices.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'plans' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Subscription Plans
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'usage' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Credit Usage ({usage.length})
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeTab === 'invoices' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Cards: Current Subscription Status & Available Credits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Current Plan Card */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Active Tier
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                currentTier === 'premium'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : currentTier === 'pro'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {currentTier}
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-black text-zinc-100 capitalize">
              {currentTier === 'free' ? 'Free Starter' : currentTier === 'pro' ? 'Pro Accelerator' : 'Premium Elite'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Status: <span className="text-emerald-400 font-semibold uppercase">{subscription?.status || 'ACTIVE'}</span>
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-400 space-y-1">
            {subscription?.currentPeriodEnd && (
              <div className="flex justify-between">
                <span>Current Cycle End:</span>
                <span className="font-mono text-zinc-200">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription?.cancelAtPeriodEnd ? (
              <div className="text-amber-400 font-medium">
                * Cancels at period end
              </div>
            ) : currentTier !== 'free' ? (
              <div className="flex justify-between pt-1">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Cancel auto-renewal
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Available Credits Card */}
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Available AI Credits
            </span>
            <span className="text-xs text-zinc-400">
              Quota: {creditBalance} / {monthlyQuota} credits
            </span>
          </div>

          <div className="flex items-baseline gap-3">
            <div className="text-3xl font-black text-zinc-100 font-mono">
              {creditBalance}
            </div>
            <span className="text-xs text-zinc-400">
              credits remaining ({percentageRemaining}% of monthly allocation)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percentageRemaining > 50
                  ? 'bg-purple-500'
                  : percentageRemaining > 20
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${percentageRemaining}%` }}
            />
          </div>

          {/* Unit costs guide */}
          <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-400">
            <div>• Tailored Resume: <span className="font-mono text-zinc-200">5 cr</span></div>
            <div>• Cover Letter: <span className="font-mono text-zinc-200">3 cr</span></div>
            <div>• Question Answer: <span className="font-mono text-zinc-200">1 cr</span></div>
            <div>• AI Simulation: <span className="font-mono text-zinc-200">10 cr</span></div>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="p-16 text-center text-sm text-zinc-400">Loading subscription and credit ledger...</div>
      ) : activeTab === 'plans' ? (
        /* Plans & Upgrade Comparison */
        <div className="space-y-6">
          {/* Interval Selector */}
          <div className="flex justify-center items-center gap-3 py-2">
            <span className={`text-xs ${billingInterval === 'month' ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`}>
              Monthly Billing
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
              className="relative w-12 h-6 rounded-full bg-zinc-800 border border-zinc-700 p-0.5 transition"
            >
              <div
                className={`w-5 h-5 rounded-full bg-purple-500 transition-transform ${
                  billingInterval === 'year' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs flex items-center gap-1.5 ${billingInterval === 'year' ? 'text-zinc-100 font-semibold' : 'text-zinc-400'}`}>
              Yearly Billing
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
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
                  className={`p-6 rounded-2xl border flex flex-col justify-between space-y-6 relative transition ${
                    isCurrent
                      ? 'bg-zinc-900/90 border-purple-500 shadow-xl'
                      : plan.popular
                      ? 'bg-zinc-900/60 border-zinc-700 hover:border-zinc-500'
                      : 'bg-zinc-900/40 border-zinc-800'
                  }`}
                >
                  {plan.popular && !isCurrent && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-purple-600 text-white shadow">
                      MOST POPULAR
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">{plan.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-zinc-100">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-400">
                        / {billingInterval === 'year' ? 'year' : 'month'}
                      </span>
                    </div>

                    {/* Features list */}
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                        Included Features:
                      </span>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                          <span className="text-purple-400">✓</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-400 text-xs font-semibold cursor-not-allowed border border-zinc-700"
                      >
                        ✓ Current Active Plan
                      </button>
                    ) : tierKey === 'free' ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl bg-zinc-800/50 text-zinc-500 text-xs font-medium cursor-not-allowed"
                      >
                        Standard Tier
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(tierKey)}
                        disabled={processingTier === tierKey}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50"
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
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100">Credit Ledger & Deductions</h2>
            <span className="text-xs text-zinc-400">Chronological AI Activity</span>
          </div>

          {usage.length === 0 ? (
            <p className="text-xs text-zinc-500 p-8 text-center">No metered operations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-3 font-medium">Activity</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Credits</th>
                    <th className="pb-3 font-medium">Balance After</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {usage.map((entry) => (
                    <tr key={entry.id} className="hover:bg-zinc-800/30">
                      <td className="py-3 text-zinc-200 font-medium">
                        {entry.description}
                        {entry.service && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-purple-400">
                            {entry.service}
                          </span>
                        )}
                      </td>
                      <td className="py-3 capitalize text-zinc-400">{entry.type}</td>
                      <td className="py-3 font-mono font-bold">
                        {entry.type === 'deduction' ? (
                          <span className="text-rose-400">-{entry.amount}</span>
                        ) : (
                          <span className="text-emerald-400">+{entry.amount}</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-zinc-300">{entry.balanceAfter} cr</td>
                      <td className="py-3 text-zinc-500 font-mono text-[11px]">
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
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100">Payment Transactions & Receipts</h2>
            <span className="text-xs text-zinc-400">India Gateway (INR / UPI / Cards)</span>
          </div>

          {invoices.length === 0 ? (
            <p className="text-xs text-zinc-500 p-8 text-center">No payment transactions recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="pb-3 font-medium">Invoice Number</th>
                    <th className="pb-3 font-medium">Plan Tier</th>
                    <th className="pb-3 font-medium">Amount</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-800/30">
                      <td className="py-3 font-mono font-semibold text-purple-300">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 uppercase text-zinc-300 font-medium">{inv.tier}</td>
                      <td className="py-3 font-mono text-zinc-100 font-bold">
                        ₹{inv.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            inv.status === 'captured'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inv.status === 'refunded'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-500 font-mono text-[11px]">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedReceipt(inv)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Payment Receipt</h3>
                <p className="text-xs font-mono text-purple-400">{selectedReceipt.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Date:</span>
                <span className="text-zinc-200">{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Item:</span>
                <span className="text-zinc-200 uppercase font-semibold">{selectedReceipt.tier} Plan Subscription</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Payment Reference:</span>
                <span className="font-mono text-zinc-300">{selectedReceipt.paymentId}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ₹{selectedReceipt.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Status:</span>
                <span className="font-bold text-emerald-400 uppercase">{selectedReceipt.status}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium hover:bg-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cancel Subscription */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100">Cancel Auto-Renewal</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-300">
              Are you sure you want to cancel auto-renewal? You will retain access to your plan features and remaining AI credits until the end of your billing cycle on{' '}
              <strong className="text-zinc-100">
                {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'period end'}
              </strong>
              .
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Reason for cancellation (optional):
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Help us improve: what could we do better?"
                className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition disabled:opacity-50"
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

