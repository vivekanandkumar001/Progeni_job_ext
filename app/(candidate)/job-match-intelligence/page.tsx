'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  type DetailedMatchRecord,
  type MatchSummaryData,
  getCandidateMatchDetails,
  getCandidateMatchSummary,
  listCandidateMatches,
  recalculateCandidateMatches,
  saveDiscoveredJob,
} from '../../../lib/api';

export default function JobMatchIntelligencePage() {
  const [matches, setMatches] = useState<DetailedMatchRecord[]>([]);
  const [summary, setSummary] = useState<MatchSummaryData | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting
  const [activeTab, setActiveTab] = useState<'all' | 'eligible' | 'potential' | 'high_fit'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'skills' | 'eligibility' | 'date'>('relevance');

  // Selected match for modal detail view
  const [selectedMatch, setSelectedMatch] = useState<DetailedMatchRecord | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let eligibility_status: string | undefined;
      let min_score: number | undefined;

      if (activeTab === 'eligible') eligibility_status = 'eligible';
      if (activeTab === 'potential') eligibility_status = 'potentially_eligible';
      if (activeTab === 'high_fit') min_score = 75;

      const [matchesRes, summaryRes] = await Promise.all([
        listCandidateMatches({
          sort: sortBy,
          eligibility_status,
          min_score,
          limit: 25,
        }),
        getCandidateMatchSummary().catch(() => null),
      ]);

      setMatches(matchesRes.matches);
      setTotal(matchesRes.total);
      if (summaryRes) setSummary(summaryRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load matching intelligence.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setError(null);
    try {
      await recalculateCandidateMatches();
      await loadData();
    } catch (err: any) {
      setError(`Recalculation error: ${err.message || err}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleSaveJob = async (jobId: string) => {
    try {
      await saveDiscoveredJob(jobId);
      alert('Job bookmarked to your saved jobs!');
    } catch (err: any) {
      alert(`Bookmark failed: ${err.message || err}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Hero & Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-subtle pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Job Match Intelligence</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Deterministic, explainable career compatibility matching against verified skills and truth claims.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/skill-gap-analyzer"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-surface-subtle transition-colors shadow-sm"
          >
            ðŸ“Š Skill Gap Analyzer
          </Link>
          <button
            type="button"
            disabled={recalculating}
            onClick={handleRecalculate}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm disabled:opacity-50"
          >
            {recalculating ? 'Recalculating AI Fitâ€¦' : 'âš¡ Recalculate Matches'}
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
              Total Evaluated Jobs
            </span>
            <div className="text-2xl font-bold text-on-surface mt-1">{summary.total_matches}</div>
            <p className="text-xs text-on-surface-variant mt-0.5">Scored across 6 dimensions</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
            <span className="text-xs font-semibold text-success uppercase tracking-wider block">
              Eligible to Apply
            </span>
            <div className="text-2xl font-bold text-success mt-1">
              {summary.eligible_count}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">Zero hard blockers</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
            <span className="text-xs font-semibold text-info uppercase tracking-wider block">
              Potentially Eligible
            </span>
            <div className="text-2xl font-bold text-info mt-1">
              {summary.potentially_eligible_count}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">Minor unstated criteria</p>
          </div>
          <div className="p-4 rounded-xl border border-surface-subtle bg-surface">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block">
              Average Match Fit
            </span>
            <div className="text-2xl font-bold text-primary mt-1">
              {summary.average_score}%
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">Weighted composite rating</p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Sorting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-surface-subtle pb-3">
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'all' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}}
          >
            All Matches ({summary?.total_matches || matches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eligible')}
            className={`py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'eligible' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}}
          >
            âœ“ Fully Eligible ({summary?.eligible_count || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('high_fit')}
            className={`py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'high_fit' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}}
          >
            â˜… High Fit (75%+)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('potential')}
            className={`py-2 text-sm font-medium border-b-2 transition-colors ${ activeTab === 'potential' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}}
          >
            Needs Review ({summary?.potentially_eligible_count || 0})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-on-surface-variant font-medium">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="relevance">Highest Fit Score</option>
            <option value="skills">Best Skill Alignment</option>
            <option value="eligibility">Eligibility First</option>
            <option value="date">Newest Jobs</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-20 text-center text-on-surface-variant">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
          <p className="text-sm">Calculating multidimensional match scores...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-danger bg-danger-container rounded-xl border border-danger/30">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-surface-subtle rounded-2xl space-y-3">
          <div className="text-3xl">âš¡</div>
          <h3 className="text-lg font-semibold text-on-surface">No Matches Calculated Yet</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            Click &ldquo;Recalculate Matches&rdquo; to evaluate your profile and truth claims against discovered active jobs.
          </p>
          <button
            type="button"
            disabled={recalculating}
            onClick={handleRecalculate}
            className="mt-2 px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {recalculating ? 'Evaluating...' : 'âš¡ Calculate Match Scores Now'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-on-surface-variant flex items-center justify-between">
            <span>Showing {matches.length} matching job opportunities</span>
            <span>Deterministic Algorithm {matches[0]?.algorithm_version || 'v5.0'}</span>
          </div>

          <div className="space-y-5">
            {matches.map((match) => {
              const job = match.job;
              const isEligible = match.eligibility_status === 'eligible';
              const isPotential = match.eligibility_status === 'potentially_eligible';
              const isIneligible = match.eligibility_status === 'ineligible';

              return (
                <div
                  key={match.id}
                  className="p-6 rounded-2xl border border-surface-subtle bg-surface hover:shadow-md transition-shadow space-y-4"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {/* Eligibility Badge */}
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${ isEligible ? 'bg-success-container text-success border border-success/40' : isPotential ? 'bg-info-container text-info border border-info/40' : isIneligible ? 'bg-danger-container text-danger border border-danger/40' : 'bg-warning-container text-warning border border-warning/40' }`}}
                        >
                          {isEligible
                            ? 'âœ“ Eligible'
                            : isPotential
                            ? 'â—‰ Potentially Eligible'
                            : isIneligible
                            ? 'âœ• Ineligible'
                            : 'â–³ Needs Review'}
                        </span>
                        <span className="text-xs text-on-surface-variant font-mono">
                          {match.confidence}% Grounded Confidence
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-on-surface">
                        {job?.job_title || 'Untitled Role'}
                      </h3>
                      <p className="text-sm font-semibold text-primary">
                        {job?.company_name || 'Employer Confidential'}
                      </p>

                      <div className="text-xs text-on-surface-variant flex flex-wrap items-center gap-2 pt-1">
                        <span>ðŸ“ {job?.location || 'Location unlisted'}</span>
                        <span>â€¢</span>
                        <span className="capitalize">{job?.workplace_mode || 'office'}</span>
                        <span>â€¢</span>
                        <span>
                          ðŸ’°{' '}
                          {job?.salary_min
                            ? `${job.salary_currency || '$'}${job.salary_min.toLocaleString()} - ${
                                job.salary_max?.toLocaleString() || 'DOE'
                              }`
                            : 'Salary unlisted'}
                        </span>
                      </div>
                    </div>

                    {/* Overall Score Circle */}
                    <div className="flex items-center sm:flex-col justify-between sm:justify-center p-3 rounded-xl bg-surface-subtle/60 border border-surface-subtle min-w-[110px] text-center">
                      <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                        Overall Fit
                      </span>
                      <div
                        className={`text-3xl font-extrabold ${ match.overall_score >= 80 ? 'text-success ' : match.overall_score >= 60 ? 'text-info ' : 'text-warning ' }`}}
                      >
                        {match.overall_score}%
                      </div>
                    </div>
                  </div>

                  {/* Dimension Scores Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 rounded-xl bg-surface-subtle/40 border border-surface-subtle/80 text-xs">
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Skills (30%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.skills_alignment}%</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Experience (20%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.experience_eligibility}%</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Role Relevance (20%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.role_relevance}%</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Education (10%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.education_eligibility}%</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Location (10%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.location_compatibility}%</span>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block text-[10px] font-medium">Salary (10%)</span>
                      <span className="font-bold text-on-surface">{match.dimension_scores.salary_compatibility}%</span>
                    </div>
                  </div>

                  {/* Blockers alert if ineligible */}
                  {match.blockers && match.blockers.length > 0 && (
                    <div className="p-3 rounded-lg bg-danger-container border border-danger/30 text-xs text-danger">
                      <strong>Hard Blockers:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {match.blockers.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills Alignment Chips */}
                  <div className="space-y-2 pt-1 text-xs">
                    {match.matched_skills && match.matched_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-success mr-1">
                          âœ“ Matched Skills:
                        </span>
                        {match.matched_skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded bg-success-container/70 text-success font-mono text-[11px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {match.missing_required_skills && match.missing_required_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-danger mr-1">
                          âœ• Missing Required:
                        </span>
                        {match.missing_required_skills.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded bg-danger-container/70 text-danger font-mono text-[11px]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="pt-3 border-t border-surface-subtle flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(match)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
                    >
                      View Detailed Breakdown
                    </button>
                    <div className="flex items-center gap-2">
                      {match.job_id && (
                        <button
                          type="button"
                          onClick={() => handleSaveJob(match.job_id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-surface-subtle hover:bg-surface-subtle text-on-surface"
                        >
                          â˜… Save Job
                        </button>
                      )}
                      {job?.application_url && (
                        <a
                          href={job.application_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          Apply on Original Board â†—
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Match Breakdown Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 border border-surface-subtle shadow-xl">
            <div className="flex items-start justify-between border-b border-surface-subtle pb-4">
              <div>
                <h2 className="text-2xl font-bold text-on-surface">
                  {selectedMatch.job?.job_title || 'Match Breakdown'}
                </h2>
                <p className="text-sm font-semibold text-primary">
                  {selectedMatch.job?.company_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="text-on-surface-variant hover:text-on-surface text-xl font-bold"
              >
                âœ•
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-sm text-on-surface">Explainable Match Breakdown</h4>
              <ul className="list-disc list-inside space-y-1 text-on-surface-variant bg-surface-subtle/50 p-3 rounded-lg">
                {selectedMatch.explanation.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>

              <h4 className="font-bold text-sm text-on-surface pt-2">Compatibility Dimensions</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-surface-subtle bg-surface">
                  <span className="font-semibold block text-on-surface">Experience Evaluation</span>
                  <p className="text-on-surface-variant mt-1">{selectedMatch.experience_details.note}</p>
                </div>
                <div className="p-3 rounded-lg border border-surface-subtle bg-surface">
                  <span className="font-semibold block text-on-surface">Education Evaluation</span>
                  <p className="text-on-surface-variant mt-1">{selectedMatch.education_details.note}</p>
                </div>
                <div className="p-3 rounded-lg border border-surface-subtle bg-surface">
                  <span className="font-semibold block text-on-surface">Location Compatibility</span>
                  <p className="text-on-surface-variant mt-1">{selectedMatch.location_details.note}</p>
                </div>
                <div className="p-3 rounded-lg border border-surface-subtle bg-surface">
                  <span className="font-semibold block text-on-surface">Salary Alignment</span>
                  <p className="text-on-surface-variant mt-1">{selectedMatch.salary_details.note}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-surface-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
