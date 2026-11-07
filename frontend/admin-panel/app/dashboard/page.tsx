'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const TOKEN_KEY = 'progeni.adminToken';

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

type Tab = 'overview' | 'usage' | 'abuse' | 'adjust';

const TIERS = [
  { key: 'premium', label: 'Premium Elite Suite', price: '₹2,499 / mo', dot: 'violet' },
  { key: 'pro', label: 'Pro Career Accelerator', price: '₹999 / mo', dot: 'blue' },
  { key: 'free', label: 'Free Starter', price: '₹0 / mo', dot: 'slate' },
];

function formatINR(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function severityChip(severity: AbuseAlert['severity']) {
  if (severity === 'high') return 'chip chip-danger';
  if (severity === 'medium') return 'chip chip-warning';
  return 'chip';
}

export default function AdminDashboardPage() {
  const [revenue, setRevenue] = useState<RevenueKPIs | null>(null);
  const [usage, setUsage] = useState<UsageKPIs | null>(null);
  const [alerts, setAlerts] = useState<AbuseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Manual Adjust Modal
  const [adjustCandidateId, setAdjustCandidateId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(50);
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch overview, usage, abuse monitoring
      const [resRev, resUsage, resAbuse] = await Promise.all([
        fetch(`${API_BASE}/api/v1/admin/billing/overview`, { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/v1/admin/billing/usage-analytics`, { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/v1/admin/billing/abuse-monitoring`, { headers })
          .then((r) => r.json())
          .catch(() => ({ ok: false })),
      ]);

      if (resRev.ok) setRevenue(resRev.analytics);
      if (resUsage.ok) setUsage(resUsage.usage);
      if (resAbuse.ok) setAlerts(resAbuse.alerts || []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to load administrative analytics'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmittingAdjust(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
      const res = await fetch(`${API_BASE}/api/v1/admin/billing/credits/adjust`, {
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

      setNotice(
        `Successfully adjusted ${adjustAmount} credits for candidate ${adjustCandidateId}. New balance: ${data.balanceRemaining}`,
      );
      setAdjustCandidateId('');
      setAdjustReason('');
      await loadData();
    } catch (err) {
      setError(errorMessage(err, 'Error executing manual credit adjustment'));
    } finally {
      setSubmittingAdjust(false);
    }
  }

  const tierCounts = TIERS.reduce((total, tier) => {
    return total + (revenue?.tierBreakdown?.[tier.key]?.count || 0);
  }, 0);

  const totalServiceCredits = Object.values(usage?.serviceBreakdown || {}).reduce(
    (total, item) => total + item.credits,
    0,
  );

  const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3; count?: number }> = [
    { id: 'overview', label: 'Revenue & plans', icon: Wallet },
    { id: 'usage', label: 'AI usage', icon: Sparkles },
    { id: 'abuse', label: 'Abuse & alerts', icon: AlertTriangle, count: alerts.length },
    { id: 'adjust', label: 'Credit adjustments', icon: SlidersHorizontal },
  ];

  return (
    <div className="animate-rise">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Control room</p>
          <h1>SaaS administration &amp; billing</h1>
          <p>
            Real-time revenue metrics, metered AI credit velocity, payment gateway telemetry and
            abuse monitoring across the platform.
          </p>
        </div>
        <div className="page-heading-actions">
          <span className="chip chip-primary">
            <ShieldCheck size={12} />
            Super admin / RBAC
          </span>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : undefined} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="notice notice-success" style={{ marginBottom: 14 }} role="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} />
            {notice}
          </span>
          <button type="button" className="button button-ghost button-sm" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 14 }} role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} />
            {error}
          </span>
          <button type="button" className="button button-ghost button-sm" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <div className="stats-grid">
        <section className="card stat-card">
          <div className="stat-top">
            <span className="stat-label">Monthly recurring revenue</span>
            <span className="stat-icon success">
              <TrendingUp size={16} />
            </span>
          </div>
          <div>
            <span className="stat-value">{formatINR(revenue?.mrr ?? 0)}</span>
            <span className="stat-footnote">ARR {formatINR(revenue?.arr ?? 0)}</span>
          </div>
        </section>

        <section className="card stat-card">
          <div className="stat-top">
            <span className="stat-label">Net captured revenue</span>
            <span className="stat-icon info">
              <Wallet size={16} />
            </span>
          </div>
          <div>
            <span className="stat-value">{formatINR(revenue?.netRevenue ?? 0)}</span>
            <span className="stat-footnote">
              Refunds {formatINR(revenue?.totalRefunds ?? 0)}
            </span>
          </div>
        </section>

        <section className="card stat-card">
          <div className="stat-top">
            <span className="stat-label">AI credits consumed</span>
            <span className="stat-icon">
              <Sparkles size={16} />
            </span>
          </div>
          <div>
            <span className="stat-value">
              {(usage?.totalCreditsConsumed ?? 0).toLocaleString()}
            </span>
            <span className="stat-footnote">Across all metered services</span>
          </div>
        </section>

        <section className="card stat-card">
          <div className="stat-top">
            <span className="stat-label">Revenue per user</span>
            <span className="stat-icon warning">
              <Users size={16} />
            </span>
          </div>
          <div>
            <span className="stat-value">{formatINR(revenue?.arpu ?? 0)}</span>
            <span className="stat-footnote">Active paying accounts</span>
          </div>
        </section>
      </div>

      <div className="segmented" role="tablist" aria-label="Billing views" style={{ marginBottom: 18 }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'active' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
              {typeof tab.count === 'number' && <span className="count">{tab.count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid-2">
          {[0, 1].map((index) => (
            <div className="card card-padding" key={index}>
              <div className="skeleton" style={{ width: '42%', height: 14 }} />
              <div className="skeleton" style={{ width: '100%', height: 54, marginTop: 18 }} />
              <div className="skeleton" style={{ width: '100%', height: 54, marginTop: 10 }} />
              <div className="skeleton" style={{ width: '100%', height: 54, marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : activeTab === 'overview' ? (
        <div className="grid-2">
          <section className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">Subscription tier distribution</h2>
                <p className="card-description">Paying accounts and monthly contribution by plan.</p>
              </div>
              <span className="chip chip-primary">{tierCounts} subscribers</span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {TIERS.map((tier) => {
                const count = revenue?.tierBreakdown?.[tier.key]?.count || 0;
                const rev = revenue?.tierBreakdown?.[tier.key]?.revenue || 0;
                const share = tierCounts > 0 ? Math.round((count / tierCounts) * 100) : 0;
                return (
                  <div className="tier-row" key={tier.key}>
                    <div className="tier-row-head">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`tier-dot ${tier.dot}`} aria-hidden />
                        <strong>{tier.label}</strong>
                      </span>
                      <span className="chip">{tier.price}</span>
                    </div>
                    <div className="meter">
                      <span style={{ width: `${share}%` }} />
                    </div>
                    <div className="tier-row-foot">
                      <span>{count} subscribers · {share}% of base</span>
                      <b>{formatINR(rev)}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">Payment gateway telemetry</h2>
                <p className="card-description">Provider posture and verification safeguards.</p>
              </div>
              <span className="chip chip-success">
                <CheckCircle2 size={12} />
                Verified
              </span>
            </div>

            <div>
              <div className="detail-row">
                <span>Provider</span>
                <span>Razorpay India · UPI, NetBanking, Cards</span>
              </div>
              <div className="detail-row">
                <span>Environment</span>
                <span className="chip chip-warning">Sandbox / verified test</span>
              </div>
              <div className="detail-row">
                <span>Webhook signature</span>
                <span className="chip chip-success">HMAC-SHA256 · timing-safe</span>
              </div>
              <div className="detail-row">
                <span>Card data safety</span>
                <span className="chip chip-success">Zero raw card / CVV storage</span>
              </div>
              <div className="detail-row">
                <span>Total captured</span>
                <span>{formatINR(revenue?.totalRevenue ?? 0)}</span>
              </div>
            </div>
          </section>
        </div>
      ) : activeTab === 'usage' ? (
        <div className="grid-2">
          <section className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">Consumption by metered service</h2>
                <p className="card-description">Credit burn per AI capability.</p>
              </div>
              <span className="chip">
                <Gauge size={12} />
                {totalServiceCredits.toLocaleString()} credits
              </span>
            </div>

            <div style={{ display: 'grid', gap: 9 }}>
              {Object.entries(usage?.serviceBreakdown || {}).map(([service, data]) => {
                const share =
                  totalServiceCredits > 0 ? Math.round((data.credits / totalServiceCredits) * 100) : 0;
                return (
                  <div className="tier-row" key={service}>
                    <div className="tier-row-head">
                      <strong style={{ textTransform: 'capitalize' }}>
                        {service.replace(/_/g, ' ')}
                      </strong>
                      <span className="chip chip-primary">{data.credits} credits</span>
                    </div>
                    <div className="meter success">
                      <span style={{ width: `${share}%` }} />
                    </div>
                    <div className="tier-row-foot">
                      <span>{data.calls} invocations</span>
                      <b>{share}%</b>
                    </div>
                  </div>
                );
              })}
              {Object.keys(usage?.serviceBreakdown || {}).length === 0 && (
                <div className="empty-state">
                  <BarChart3 />
                  No metered service activity recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">Top AI consumers</h2>
                <p className="card-description">Highest credit velocity across the platform.</p>
              </div>
              <span className="chip">{usage?.topConsumers?.length || 0} accounts</span>
            </div>

            <div>
              {(usage?.topConsumers || []).map((consumer, index) => (
                <div className="rank-row" key={consumer.candidateId}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="rank-index">{index + 1}</span>
                    <strong className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {consumer.candidateId}
                    </strong>
                  </span>
                  <span className="rank-value">{consumer.creditsConsumed} cr</span>
                </div>
              ))}
              {(usage?.topConsumers || []).length === 0 && (
                <div className="empty-state">
                  <Users />
                  No consumer activity to rank yet.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : activeTab === 'abuse' ? (
        <section className="card card-padding">
          <div className="card-header">
            <div>
              <h2 className="card-title">Abuse detection &amp; high-velocity guard</h2>
              <p className="card-description">
                Automatic flags for anomalous consumption or repeated payment failures.
              </p>
            </div>
            <span className="chip chip-warning">Threshold &gt; 250 credits / 24h</span>
          </div>

          {alerts.length === 0 ? (
            <div className="empty-state">
              <BadgeCheck />
              No active abuse anomalies or high-velocity flags detected.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {alerts.map((alert, index) => (
                <div
                  key={`${alert.candidateId}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 14,
                    padding: '14px 15px',
                    border: '1px solid rgb(var(--danger) / 0.25)',
                    borderRadius: 12,
                    background: 'rgb(var(--danger-container) / 0.55)',
                  }}
                >
                  <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={severityChip(alert.severity)}>{alert.severity}</span>
                      <strong style={{ color: 'rgb(var(--on-surface))', fontSize: 12.5 }}>
                        {alert.reason}
                      </strong>
                    </div>
                    <span style={{ color: 'rgb(var(--on-surface-variant))', fontSize: 11.5 }}>
                      Candidate <span className="mono">{alert.candidateId}</span>
                    </span>
                    <span style={{ color: 'rgb(var(--on-surface-variant))', fontSize: 10.5 }}>
                      {alert.metric}: <b style={{ color: 'rgb(var(--on-surface))' }}>{alert.value}</b>
                      {' · '}Flagged {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <AlertTriangle size={17} style={{ flex: '0 0 17px', color: 'rgb(var(--danger))' }} />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div style={{ maxWidth: 620 }}>
          <section className="card card-padding">
            <div className="card-header">
              <div>
                <h2 className="card-title">Manual credit adjustment</h2>
                <p className="card-description">
                  Add or deduct credits for a candidate. Every adjustment is audit-logged.
                </p>
              </div>
              <span className="stat-icon">
                <Activity size={16} />
              </span>
            </div>

            <form onSubmit={handleAdjustSubmit} style={{ display: 'grid', gap: 14 }}>
              <label className="field">
                Candidate user ID (UUID)
                <input
                  type="text"
                  required
                  value={adjustCandidateId}
                  onChange={(e) => setAdjustCandidateId(e.target.value)}
                  placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                />
              </label>

              <label className="field">
                Adjustment amount (positive to add, negative to deduct)
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(Number(e.target.value))}
                  placeholder="e.g. 50 or -20"
                />
              </label>

              <label className="field">
                Audit reason / justification
                <textarea
                  rows={3}
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Compensation for a temporary service outage during interview simulation"
                />
              </label>

              <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                <span className="chip">
                  <CreditCard size={12} />
                  Immutable audit trail
                </span>
                <button type="submit" className="button button-primary" disabled={submittingAdjust}>
                  {submittingAdjust ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal size={15} />
                      Apply adjustment
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
