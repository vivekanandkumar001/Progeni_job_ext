'use client';

import { useEffect, useState } from 'react';

interface RevenueKPIs {
  mrr: number;
  arr: number;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  arpu: number;
  tierBreakdown: Record<string, { count: number; revenue: number }>;
}

interface UsageKPIs {
  totalCreditsConsumed: number;
  serviceBreakdown: Record<string, { calls: number; credits: number }>;
  topConsumers: Array<{ candidateId: string; creditsConsumed: number }>;
}

interface AbuseAlert {
  candidateId: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
  metric: string;
  value: number;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const [revenue, setRevenue] = useState<RevenueKPIs | null>(null);
  const [usage, setUsage] = useState<UsageKPIs | null>(null);
  const [alerts, setAlerts] = useState<AbuseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'abuse' | 'adjust'>('overview');

  // Manual Adjust Modal
  const [adjustCandidateId, setAdjustCandidateId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch overview, usage, abuse monitoring
      const [resRev, resUsage, resAbuse] = await Promise.all([
        fetch('http://127.0.0.1:5000/api/v1/admin/billing/overview', { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
        fetch('http://127.0.0.1:5000/api/v1/admin/billing/usage-analytics', { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
        fetch('http://127.0.0.1:5000/api/v1/admin/billing/abuse-monitoring', { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
      ]);

      if (resRev.ok) setRevenue(resRev.analytics);
      if (resUsage.ok) setUsage(resUsage.usage);
      if (resAbuse.ok) setAlerts(resAbuse.alerts || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative analytics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingAdjust(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const res = await fetch('http://127.0.0.1:5000/api/v1/admin/billing/credits/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          candidateId: adjustCandidateId,
          amount: Number(adjustAmount),
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to adjust credits');
      }

      setNotice(`Successfully adjusted ${adjustAmount} credits for candidate ${adjustCandidateId}! New balance: ${data.balanceRemaining}`);
      setAdjustCandidateId('');
      setAdjustReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error executing manual credit adjustment');
    } finally {
      setSubmittingAdjust(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">SaaS Administration & Billing Portal</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              SUPER ADMIN / RBAC
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time revenue metrics, metered AI credit velocity, payment gateway telemetry, and abuse monitoring.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'overview' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Revenue & Plans
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'usage' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            AI Usage Metering
          </button>
          <button
            onClick={() => setActiveTab('abuse')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'abuse' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Abuse & Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'adjust' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Credit Adjustments
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex justify-between items-center">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs text-rose-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-medium">Monthly Recurring Revenue</span>
          <div className="text-2xl font-black font-mono text-emerald-400">
            ₹{(revenue?.mrr ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-zinc-500 block">ARR: ₹{(revenue?.arr ?? 0).toLocaleString('en-IN')}</span>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-medium">Net Captured Revenue</span>
          <div className="text-2xl font-black font-mono text-zinc-100">
            ₹{(revenue?.netRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-zinc-500 block">Refunds: ₹{(revenue?.totalRefunds ?? 0).toLocaleString('en-IN')}</span>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-medium">Total AI Credits Consumed</span>
          <div className="text-2xl font-black font-mono text-purple-400">
            {(usage?.totalCreditsConsumed ?? 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-zinc-500 block">Across all metered services</span>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
          <span className="text-xs text-zinc-400 uppercase font-medium">Average Revenue Per User</span>
          <div className="text-2xl font-black font-mono text-indigo-400">
            ₹{(revenue?.arpu ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-zinc-500 block">Active paying accounts</span>
        </div>
      </div>

      {/* Main Tab Panels */}
      {loading ? (
        <div className="p-16 text-center text-zinc-500 text-sm">Loading administrative analytics...</div>
      ) : activeTab === 'overview' ? (
        /* Revenue & Tier Distribution */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscriptions by Tier */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-100">Subscription Tier Distribution</h2>
            <div className="space-y-3">
              {[
                { key: 'premium', label: 'Premium Elite Suite (₹2,499/mo)', color: 'bg-purple-500' },
                { key: 'pro', label: 'Pro Career Accelerator (₹999/mo)', color: 'bg-indigo-500' },
                { key: 'free', label: 'Free Starter (₹0/mo)', color: 'bg-zinc-600' },
              ].map((tier) => {
                const count = revenue?.tierBreakdown?.[tier.key]?.count || 0;
                const rev = revenue?.tierBreakdown?.[tier.key]?.revenue || 0;
                return (
                  <div key={tier.key} className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{tier.label}</span>
                      <span className="font-mono text-zinc-400">{count} Subscribers</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Monthly Contribution:</span>
                      <span className="font-mono text-emerald-400 font-semibold">₹{rev.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Gateway Telemetry */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-100">Payment Gateway Telemetry</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-zinc-400">Provider:</span>
                <span className="font-bold text-zinc-200">Razorpay India (UPI, NetBanking, Cards)</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-zinc-400">Environment Mode:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SANDBOX / VERIFIED TEST
                </span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-zinc-400">Webhook Signature Verification:</span>
                <span className="text-emerald-400 font-semibold">✓ HMAC-SHA256 Timing-Safe</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-zinc-800/40">
                <span className="text-zinc-400">PCI-DSS Credentials Safety:</span>
                <span className="text-emerald-400 font-semibold">✓ Zero Raw Card/CVV Storage</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'usage' ? (
        /* Usage Analytics */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-100">Consumption by Metered Service</h2>
            <div className="space-y-2.5">
              {Object.entries(usage?.serviceBreakdown || {}).map(([service, data]) => (
                <div key={service} className="p-3 rounded-xl bg-zinc-800/50 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-zinc-200 capitalize">{service.replace(/_/g, ' ')}</span>
                    <span className="text-zinc-500 text-[11px] block">{data.calls} invocations</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-300 text-sm">{data.credits}</span>
                    <span className="text-zinc-500 text-[10px] block">credits</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
            <h2 className="text-base font-bold text-zinc-100">Top AI Consumers</h2>
            <div className="space-y-2.5">
              {(usage?.topConsumers || []).map((consumer, idx) => (
                <div key={consumer.candidateId} className="p-3 rounded-xl bg-zinc-800/50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-[10px] text-zinc-300">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-zinc-300 text-[11px]">{consumer.candidateId}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">{consumer.creditsConsumed} cr</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'abuse' ? (
        /* Abuse Monitoring */
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100">Abuse Detection & High Velocity Guard</h2>
            <span className="text-xs text-zinc-400">Threshold: &gt; 250 credits/24h or &ge; 2 payment failures</span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">
              ✓ No active abuse anomalies or high-velocity flags detected.
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500 text-white">
                        {alert.severity}
                      </span>
                      <span className="font-semibold text-rose-300">{alert.reason}</span>
                    </div>
                    <p className="text-zinc-400">
                      Candidate ID: <span className="font-mono text-zinc-200">{alert.candidateId}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {alert.metric}: <strong className="text-zinc-300">{alert.value}</strong> • Flagged: {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Manual Credit Adjustments */
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 max-w-xl mx-auto space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Manual Credit Adjustment</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Add or deduct credits for a candidate with an immutable administrative audit log.
            </p>
          </div>

          <form onSubmit={handleAdjustSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Candidate User ID (UUID)
              </label>
              <input
                type="text"
                required
                value={adjustCandidateId}
                onChange={(e) => setAdjustCandidateId(e.target.value)}
                placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Adjustment Amount (Positive to add, negative to deduct)
              </label>
              <input
                type="number"
                required
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Number(e.target.value))}
                placeholder="e.g. 50 or -20"
                className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Audit Reason / Justification
              </label>
              <textarea
                rows={3}
                required
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Compensation for temporary service outage during interview simulation"
                className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingAdjust}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {submittingAdjust ? 'Applying Adjustment...' : 'Apply Credit Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
