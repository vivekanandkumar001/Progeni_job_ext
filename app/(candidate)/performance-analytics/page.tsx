'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getApplicationAnalyticsData,
  type AppAnalyticsItem,
} from '../../../lib/api';

export default function PerformanceAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AppAnalyticsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await getApplicationAnalyticsData();
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load application analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            Performance & Conversion Analytics
          </h1>
          <p className="text-sm text-on-surface-variant">
            Explainable, deterministic conversion rates backed by transparent denominators.
          </p>
        </div>

        <Link
          href="/application-tracker"
          className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition self-start sm:self-auto"
        >
          ← Application Tracker
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-on-surface-variant">Calculating analytics...</div>
      ) : !analytics ? (
        <div className="p-12 text-center text-sm text-on-surface-variant">No analytics data available.</div>
      ) : (
        <div className="space-y-6">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Applications */}
            <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-1">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Total Applications
              </span>
              <div className="text-2xl font-bold text-on-surface">{analytics.totalApplications}</div>
              <div className="text-[11px] text-on-surface-variant">
                {analytics.pendingApplications} in preparation • {analytics.verifiedSubmissions + analytics.candidateReportedSubmissions} submitted
              </div>
            </div>

            {/* Response Rate */}
            <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-1">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Employer Response Rate
              </span>
              <div className="text-2xl font-bold text-primary">{analytics.responseRate}%</div>
              <div className="text-[11px] text-on-surface-variant">
                {analytics.responses} positive/negative responses
              </div>
            </div>

            {/* Interview Rate */}
            <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-1">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Interview Conversion Rate
              </span>
              <div className="text-2xl font-bold text-primary">
                {analytics.interviewConversionRate}%
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {analytics.interviewsScheduled} interviews scheduled
              </div>
            </div>

            {/* Offer Rate */}
            <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-1">
              <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                Offer Conversion Rate
              </span>
              <div className="text-2xl font-bold text-success">
                {analytics.offerConversionRate}%
              </div>
              <div className="text-[11px] text-on-surface-variant">
                {analytics.offersReceived + analytics.offersAccepted} offers received
              </div>
            </div>
          </div>

          {/* Submission Verification Breakdown */}
          <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              Submission Verification Audit Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-surface-subtle border border-outline space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-success">Verified Submissions</span>
                  <span className="text-base font-bold text-on-surface">
                    {analytics.verifiedSubmissions}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Confirmed with external reference number or ATS portal destination
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-subtle border border-outline space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-warning">Candidate-Reported Submissions</span>
                  <span className="text-base font-bold text-on-surface">
                    {analytics.candidateReportedSubmissions}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Candidate confirmed manual completion with notes or confirmation snippet
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-subtle border border-outline space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-on-surface-variant">Unsubmitted / In Progress</span>
                  <span className="text-base font-bold text-on-surface">
                    {analytics.pendingApplications}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Discovered, preparing, or awaiting approval (strictly excluded from denominators)
                </p>
              </div>
            </div>
          </div>

          {/* Lifecycle Stage Breakdown Funnel */}
          <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              Stage Funnel Distribution
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {Object.entries(analytics.stageBreakdown).map(([stage, count]) => (
                <div
                  key={stage}
                  className="p-3 rounded-lg bg-surface-subtle border border-outline-variant text-center space-y-1"
                >
                  <div className="text-lg font-bold text-on-surface">{count}</div>
                  <div className="text-[10px] font-medium text-on-surface-variant uppercase tracking-tight">
                    {stage.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transparent Denominator Documentation */}
          <div className="p-5 bg-primary/20 border border-primary/20 rounded-xl space-y-3 text-xs text-on-surface-variant">
            <h3 className="font-semibold text-primary text-sm flex items-center gap-1.5">
              <span>📐</span> Mathematical Formulae & Denominators
            </h3>
            <ul className="space-y-2 text-on-surface-variant leading-relaxed">
              <li>
                <strong className="text-on-surface">Response Rate:</strong>{' '}
                <code>{analytics.denominators.responseRateDenominator}</code>
              </li>
              <li>
                <strong className="text-on-surface">Interview Conversion Rate:</strong>{' '}
                <code>{analytics.denominators.interviewRateDenominator}</code>
              </li>
              <li>
                <strong className="text-on-surface">Offer Conversion Rate:</strong>{' '}
                <code>{analytics.denominators.offerRateDenominator}</code>
              </li>
            </ul>
          </div>

          {/* Prominent Non-Guarantee Disclaimer */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface-variant leading-relaxed space-y-1">
            <strong className="text-on-surface-variant block font-semibold">Regulatory Notice & Disclaimer:</strong>
            <p>{analytics.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
