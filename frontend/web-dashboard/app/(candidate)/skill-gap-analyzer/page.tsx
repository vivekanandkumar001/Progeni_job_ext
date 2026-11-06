'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getCandidateSkillGaps, type SkillGapAnalysisData } from '../../../lib/api';

export default function SkillGapAnalyzerPage() {
  const [data, setData] = useState<SkillGapAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCandidateSkillGaps();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze skill gaps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGaps();
  }, [loadGaps]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-subtle pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Skill Gap Analyzer</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Real-time market demand comparison across your target roles to prioritize skill growth.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/job-match-intelligence"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-surface-subtle transition-colors shadow-sm"
          >
            ← Back to Match Intelligence
          </Link>
          <button
            type="button"
            onClick={loadGaps}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
          >
            ↻ Refresh Analytics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-on-surface-variant">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
          <p className="text-sm">Analyzing posting requirements across target roles...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-danger bg-danger-container rounded-xl border border-danger/30">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={loadGaps}
            className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-danger text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : !data ? (
        <div className="py-16 text-center text-on-surface-variant">No data available.</div>
      ) : (
        <div className="space-y-6">
          {/* Target Role & Scope Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
                Target Roles Analyzed
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.target_roles.length > 0 ? (
                  data.target_roles.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary"
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-on-surface-variant italic">All Active Positions</span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
                Postings Analyzed
              </span>
              <div className="text-2xl font-bold text-on-surface mt-1">{data.total_jobs_analyzed}</div>
              <p className="text-xs text-on-surface-variant mt-0.5">Active market listings</p>
            </div>

            <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
              <span className="text-xs font-semibold text-success uppercase tracking-wider block">
                Verified Candidate Skills
              </span>
              <div className="text-2xl font-bold text-success mt-1">
                {data.verified_candidate_skills.length}
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">Backed by verified claims</p>
            </div>
          </div>

          {/* Top In-Demand Missing Skills */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Top Missing Skills in Target Roles</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Skills most frequently declared as mandatory or preferred in target job listings.
              </p>
            </div>

            {data.top_missing_skills.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-surface-subtle bg-surface text-on-surface-variant">
                <span className="text-2xl block mb-1">🎉</span>
                <p className="font-semibold text-on-surface">Zero Skill Gaps Detected!</p>
                <p className="text-xs mt-1">Your skills match all requirements across target active listings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.top_missing_skills.map((gap) => (
                  <div
                    key={gap.skill}
                    className="p-5 rounded-xl border border-surface-subtle bg-surface space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider mb-1 ${ gap.importance === 'required' ? 'bg-danger-container text-danger ' : 'bg-info-container text-info ' }`}
                        >
                          {gap.importance === 'required' ? 'High Priority (Required)' : 'Bonus (Preferred)'}
                        </span>
                        <h3 className="text-lg font-bold text-on-surface font-mono">{gap.skill}</h3>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-subtle text-on-surface">
                        {gap.demand_count} jobs
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {gap.suggested_action}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggested Learning Priorities */}
          {data.suggested_learning_priorities.length > 0 && (
            <div className="p-6 rounded-2xl border border-surface-subtle bg-surface space-y-4">
              <h2 className="text-lg font-bold text-on-surface">Suggested Learning Roadmap Priorities</h2>
              <div className="space-y-3">
                {data.suggested_learning_priorities.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-subtle/50 border border-surface-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface font-mono">{item.skill}</span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase ${ item.importance === 'high' ? 'bg-danger-container text-danger ' : 'bg-info-container text-info ' }`}
                        >
                          {item.importance} priority
                        </span>
                      </div>
                      <p className="text-on-surface-variant">{item.recommended_action}</p>
                    </div>
                    <span className="text-on-surface-variant font-medium whitespace-nowrap">
                      Appears in ~{item.job_mention_percentage}% of target roles
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legal / Compliance Disclaimer */}
          <div className="p-4 rounded-xl bg-surface-subtle/40 border border-surface-subtle/70 text-xs text-on-surface-variant italic leading-relaxed">
            <strong>Notice & Disclaimer:</strong> {data.disclaimer}
          </div>
        </div>
      )}
    </div>
  );
}
