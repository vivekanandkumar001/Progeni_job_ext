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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Performance & Conversion Analytics
          </h1>
          <p className="text-sm text-zinc-400">
            Explainable, deterministic conversion rates backed by transparent denominators.
          </p>
        </div>

        <Link
          href="/application-tracker"
          className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition self-start sm:self-auto"
        >
          ← Application Tracker
        </Link>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-400">Calculating analytics...</div>
      ) : !analytics ? (
        <div className="p-12 text-center text-sm text-zinc-400">No analytics data available.</div>
      ) : (
        <div className="space-y-6">
          {/* Top Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Applications */}
            <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Total Applications
              </span>
              <div className="text-2xl font-bold text-zinc-100">{analytics.totalApplications}</div>
              <div className="text-[11px] text-zinc-500">
                {analytics.pendingApplications} in preparation • {analytics.verifiedSubmissions + analytics.candidateReportedSubmissions} submitted
              </div>
            </div>

            {/* Response Rate */}
            <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Employer Response Rate
              </span>
              <div className="text-2xl font-bold text-indigo-400">{analytics.responseRate}%</div>
              <div className="text-[11px] text-zinc-500">
                {analytics.responses} positive/negative responses
              </div>
            </div>

            {/* Interview Rate */}
            <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Interview Conversion Rate
              </span>
              <div className="text-2xl font-bold text-purple-400">
                {analytics.interviewConversionRate}%
              </div>
              <div className="text-[11px] text-zinc-500">
                {analytics.interviewsScheduled} interviews scheduled
              </div>
            </div>

            {/* Offer Rate */}
            <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Offer Conversion Rate
              </span>
              <div className="text-2xl font-bold text-emerald-400">
                {analytics.offerConversionRate}%
              </div>
              <div className="text-[11px] text-zinc-500">
                {analytics.offersReceived + analytics.offersAccepted} offers received
              </div>
            </div>
          </div>

          {/* Submission Verification Breakdown */}
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Submission Verification Audit Breakdown
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-emerald-400">Verified Submissions</span>
                  <span className="text-base font-bold text-zinc-100">
                    {analytics.verifiedSubmissions}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Confirmed with external reference number or ATS portal destination
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-amber-400">Candidate-Reported Submissions</span>
                  <span className="text-base font-bold text-zinc-100">
                    {analytics.candidateReportedSubmissions}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Candidate confirmed manual completion with notes or confirmation snippet
                </p>
              </div>

              <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-1">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-zinc-400">Unsubmitted / In Progress</span>
                  <span className="text-base font-bold text-zinc-100">
                    {analytics.pendingApplications}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Discovered, preparing, or awaiting approval (strictly excluded from denominators)
                </p>
              </div>
            </div>
          </div>

          {/* Lifecycle Stage Breakdown Funnel */}
          <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Stage Funnel Distribution
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {Object.entries(analytics.stageBreakdown).map(([stage, count]) => (
                <div
                  key={stage}
                  className="p-3 rounded-lg bg-zinc-800/40 border border-zinc-800 text-center space-y-1"
                >
                  <div className="text-lg font-bold text-zinc-100">{count}</div>
                  <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight">
                    {stage.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transparent Denominator Documentation */}
          <div className="p-5 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-3 text-xs text-zinc-300">
            <h3 className="font-semibold text-indigo-300 text-sm flex items-center gap-1.5">
              <span>📐</span> Mathematical Formulae & Denominators
            </h3>
            <ul className="space-y-2 text-zinc-400 leading-relaxed">
              <li>
                <strong className="text-zinc-200">Response Rate:</strong>{' '}
                <code>{analytics.denominators.responseRateDenominator}</code>
              </li>
              <li>
                <strong className="text-zinc-200">Interview Conversion Rate:</strong>{' '}
                <code>{analytics.denominators.interviewRateDenominator}</code>
              </li>
              <li>
                <strong className="text-zinc-200">Offer Conversion Rate:</strong>{' '}
                <code>{analytics.denominators.offerRateDenominator}</code>
              </li>
            </ul>
          </div>

          {/* Prominent Non-Guarantee Disclaimer */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-500 leading-relaxed space-y-1">
            <strong className="text-zinc-400 block font-semibold">Regulatory Notice & Disclaimer:</strong>
            <p>{analytics.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
