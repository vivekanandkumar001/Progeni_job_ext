'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type CandidateSavedJobItem,
  type DiscoveredJob,
  type DiscoveredJobsResponse,
  getDiscoveredJobDetails,
  importCandidateJob,
  listCandidateSavedJobs,
  listDiscoveredJobs,
  saveDiscoveredJob,
  triggerJobDiscovery,
  unsaveDiscoveredJob,
} from '../../../lib/api';

type TabMode = 'personalized' | 'all' | 'saved';

export default function JobRecommendationsPage() {
  const [tab, setTab] = useState<TabMode>('personalized');
  const [jobs, setJobs] = useState<DiscoveredJob[]>([]);
  const [savedJobs, setSavedJobs] = useState<CandidateSavedJobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [workplaceMode, setWorkplaceMode] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [minSalary, setMinSalary] = useState<string>('');
  const [locationQuery, setLocationQuery] = useState('');

  // Selected Job for Details Modal
  const [selectedJob, setSelectedJob] = useState<DiscoveredJob | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Import Job Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importCompany, setImportCompany] = useState('');
  const [importLocation, setImportLocation] = useState('');
  const [importMode, setImportMode] = useState<'remote' | 'hybrid' | 'office'>('remote');
  const [importSalary, setImportSalary] = useState('');
  const [importDescription, setImportDescription] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);

  // Trigger Discovery State
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'saved') {
        const res = await listCandidateSavedJobs(page, 15);
        setSavedJobs(res.saved_jobs);
        setTotal(res.total);
        setTotalPages(Math.ceil(res.total / 15) || 1);
      } else {
        const res: DiscoveredJobsResponse = await listDiscoveredJobs({
          q: searchQuery.trim() || undefined,
          location: locationQuery.trim() || undefined,
          workplace_mode: workplaceMode || undefined,
          provider: providerFilter || undefined,
          min_salary: minSalary ? Number(minSalary) : undefined,
          personalized: tab === 'personalized',
          page,
          limit: 15,
        });
        setJobs(res.jobs);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, searchQuery, locationQuery, workplaceMode, providerFilter, minSalary]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleTabChange = (newTab: TabMode) => {
    setTab(newTab);
    setPage(1);
  };

  const handleToggleSave = async (job: DiscoveredJob) => {
    try {
      if (job.is_saved) {
        await unsaveDiscoveredJob(job.id);
        job.is_saved = false;
      } else {
        await saveDiscoveredJob(job.id);
        job.is_saved = true;
      }
      setJobs([...jobs]);
      if (tab === 'saved') {
        loadJobs();
      }
    } catch (err: any) {
      alert(`Save error: ${err.message || err}`);
    }
  };

  const handleOpenDetails = async (jobId: string) => {
    setDetailsLoading(true);
    try {
      const full = await getDiscoveredJobDetails(jobId);
      setSelectedJob(full);
    } catch (err: any) {
      alert(`Could not load job details: ${err.message || err}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleTriggerDiscovery = async () => {
    setDiscovering(true);
    setDiscoveryStatus('Running discovery crawl across Greenhouse, Lever, Ashby & SmartRecruiters...');
    try {
      const metrics = await triggerJobDiscovery();
      setDiscoveryStatus(
        `Discovery finished: Found ${metrics.jobs_found || 0} postings, inserted ${metrics.jobs_inserted || 0}, updated ${metrics.jobs_updated || 0}.`,
      );
      await loadJobs();
    } catch (err: any) {
      setDiscoveryStatus(`Discovery run: ${err.message || err}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTitle.trim() && !importUrl.trim() && !importDescription.trim()) {
      alert('Please provide at least a job title, description, or URL.');
      return;
    }
    setImportSubmitting(true);
    try {
      const imported = await importCandidateJob({
        url: importUrl.trim() || undefined,
        title: importTitle.trim() || undefined,
        companyName: importCompany.trim() || undefined,
        location: importLocation.trim() || undefined,
        workplaceMode: importMode,
        salary: importSalary.trim() || undefined,
        descriptionText: importDescription.trim() || undefined,
        provider: 'manual',
      });
      setShowImportModal(false);
      setImportUrl('');
      setImportTitle('');
      setImportCompany('');
      setImportLocation('');
      setImportSalary('');
      setImportDescription('');
      await loadJobs();
      handleOpenDetails(imported.id);
    } catch (err: any) {
      alert(`Import failed: ${err.message || err}`);
    } finally {
      setImportSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-subtle pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Job Discovery & Recommendations</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Multi-source canonical job postings from Greenhouse, Lever, Ashby, SmartRecruiters, and Workday.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={discovering}
            onClick={handleTriggerDiscovery}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-surface-subtle transition-colors shadow-sm disabled:opacity-50"
          >
            {discovering ? 'Crawling sourcesâ€¦' : 'â†» Crawl Live Sources'}
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors shadow-sm"
          >
            + Import Job Posting
          </button>
        </div>
      </div>

      {discoveryStatus && (
        <div className="p-3 text-sm rounded-lg bg-info-container text-info border border-info/30 flex items-center justify-between">
          <span>{discoveryStatus}</span>
          <button
            type="button"
            onClick={() => setDiscoveryStatus(null)}
            className="text-xs font-semibold hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-surface-subtle space-x-8">
        <button
          type="button"
          onClick={() => handleTabChange('personalized')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${ tab === 'personalized' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}
        >
          âœ¦ Recommended For You
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${ tab === 'all' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}
        >
          ðŸ” Explore All Postings
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('saved')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${ tab === 'saved' ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}
        >
          â˜… Saved Jobs
        </button>
      </div>

      {/* Filter / Search Bar (for personalized & all) */}
      {tab !== 'saved' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 rounded-xl bg-surface-subtle/50 border border-surface-subtle">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Search Keywords</label>
            <input
              type="text"
              placeholder="e.g. Software Engineer, React, Stripe..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Workplace Mode</label>
            <select
              value={workplaceMode}
              onChange={(e) => {
                setWorkplaceMode(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Any Mode</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="office">Office / On-site</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">ATS Provider</label>
            <select
              value={providerFilter}
              onChange={(e) => {
                setProviderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Providers</option>
              <option value="greenhouse">Greenhouse</option>
              <option value="lever">Lever</option>
              <option value="ashby">Ashby</option>
              <option value="smartrecruiters">SmartRecruiters</option>
              <option value="workday">Workday</option>
              <option value="manual">Manual / Extension</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Location</label>
            <input
              type="text"
              placeholder="e.g. San Francisco, US"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center text-on-surface-variant">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
          <p className="text-sm">Loading job opportunities...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-danger bg-danger-container rounded-xl border border-danger/30">
          <p className="font-medium">{error}</p>
          <button
            type="button"
            onClick={loadJobs}
            className="mt-3 px-4 py-1.5 text-xs font-medium rounded-lg bg-danger text-white hover:bg-danger/90"
          >
            Retry
          </button>
        </div>
      ) : tab === 'saved' ? (
        // Saved Jobs View
        savedJobs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-surface-subtle rounded-2xl">
            <div className="text-3xl mb-2">â˜…</div>
            <h3 className="text-lg font-semibold text-on-surface">No Saved Jobs Yet</h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
              Bookmark jobs from the recommendations or explore tab to keep track of target opportunities.
            </p>
            <button
              type="button"
              onClick={() => handleTabChange('personalized')}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Browse Recommendations
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {savedJobs.map((item) => {
              const job = item.job;
              if (!job) return null;
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between p-5 rounded-xl border border-surface-subtle bg-surface hover:shadow-md transition-shadow"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-surface-subtle text-on-surface-variant uppercase tracking-wider mb-1">
                          {job.provider}
                        </span>
                        <h3 className="font-semibold text-lg text-on-surface line-clamp-2">{job.job_title}</h3>
                        <p className="text-sm font-medium text-primary mt-0.5">{job.company_name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSave({ ...job, is_saved: true })}
                        className="text-warning hover:text-warning p-1 rounded hover:bg-surface-subtle"
                        title="Remove bookmark"
                      >
                        â˜…
                      </button>
                    </div>

                    <div className="text-xs text-on-surface-variant space-y-1">
                      <div className="flex items-center gap-2">
                        <span>ðŸ“ {job.location || 'Location unlisted'}</span>
                        <span>â€¢</span>
                        <span className="capitalize">{job.workplace_mode}</span>
                      </div>
                      <div className="font-medium text-on-surface">
                        ðŸ’° {job.salary_min ? `${job.salary_currency || '$'}${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString() || 'DOE'}` : 'Salary not disclosed'}
                      </div>
                    </div>

                    {item.notes && (
                      <div className="p-2 text-xs rounded bg-surface-subtle/70 text-on-surface-variant italic">
                        Note: {item.notes}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-surface-subtle/70 mt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(job.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
                    >
                      View Details
                    </button>
                    {job.application_url && (
                      <a
                        href={job.application_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Apply on Board â†—
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : jobs.length === 0 ? (
        // Empty State for Personalized or Explore
        <div className="py-20 text-center border-2 border-dashed border-surface-subtle rounded-2xl">
          <div className="text-3xl mb-2">ðŸ”</div>
          <h3 className="text-lg font-semibold text-on-surface">No Jobs Found</h3>
          <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
            {tab === 'personalized'
              ? 'We could not find active jobs matching your profile. Try exploring all jobs or click "Crawl Live Sources".'
              : 'No jobs match your current search filters. Try widening your criteria or crawl live sources.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTriggerDiscovery}
              disabled={discovering}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {discovering ? 'Crawling...' : 'Crawl Live Sources'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setWorkplaceMode('');
                setProviderFilter('');
                setLocationQuery('');
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        // Job Cards Grid
        <div className="space-y-4">
          <div className="text-xs text-on-surface-variant flex items-center justify-between">
            <span>Showing {jobs.length} of {total} postings</span>
            <span>Page {page} of {totalPages}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between p-5 rounded-xl border border-surface-subtle bg-surface hover:shadow-md transition-shadow relative"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-surface-subtle text-on-surface-variant uppercase tracking-wider">
                          {job.provider}
                        </span>
                        {job.personalized_score !== undefined && (
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${ job.personalized_score >= 70 ? 'bg-success-container text-success ' : job.personalized_score >= 40 ? 'bg-info-container text-info ' : 'bg-surface-subtle text-on-surface-variant' }`}
                          >
                            {job.personalized_score}% Match
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg text-on-surface leading-snug line-clamp-2">
                        {job.job_title}
                      </h3>
                      <p className="text-sm font-medium text-primary mt-0.5">{job.company_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleSave(job)}
                      className={`p-1.5 rounded-lg border transition-colors ${ job.is_saved ? 'border-warning/30 text-warning bg-warning-container ' : 'border-surface-subtle text-on-surface-variant hover:text-on-surface hover:bg-surface-subtle' }`}
                      title={job.is_saved ? 'Unsave job' : 'Save job'}
                    >
                      {job.is_saved ? 'â˜…' : 'â˜†'}
                    </button>
                  </div>

                  {/* Match reasons chips if present */}
                  {job.match_reasons && job.match_reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {job.match_reasons.slice(0, 2).map((reason, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-success-container text-success border border-success/40"
                        >
                          âœ“ {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-on-surface-variant space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span>ðŸ“ {job.location || 'Location unlisted'}</span>
                      <span>â€¢</span>
                      <span className="capitalize font-medium">{job.workplace_mode}</span>
                    </div>
                    <div className="font-medium text-on-surface">
                      ðŸ’°{' '}
                      {job.salary_min
                        ? `${job.salary_currency || '$'}${job.salary_min.toLocaleString()} - ${
                            job.salary_max ? `${job.salary_max.toLocaleString()}` : 'DOE'
                          }`
                        : 'Salary not disclosed'}
                    </div>
                  </div>

                  {/* Skills preview */}
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {job.required_skills.slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-0.5 text-[11px] rounded bg-surface-subtle text-on-surface-variant font-mono"
                        >
                          {skill}
                        </span>
                      ))}
                      {job.required_skills.length > 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] text-on-surface-variant">
                          +{job.required_skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-surface-subtle/70 mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(job.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
                  >
                    View Details
                  </button>
                  {job.application_url && (
                    <a
                      href={job.application_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Apply on Board â†—
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6 border-t border-surface-subtle">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-on-surface-variant font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Job Details Modal Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface p-4">
          <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-5 border border-surface-subtle shadow-soft">
            <div className="flex items-start justify-between border-b border-surface-subtle pb-4">
              <div>
                <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded bg-surface-subtle uppercase tracking-wider mb-1">
                  {selectedJob.provider}
                </span>
                <h2 className="text-2xl font-bold text-on-surface">{selectedJob.job_title}</h2>
                <p className="text-base font-semibold text-primary">{selectedJob.company_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="text-on-surface-variant hover:text-on-surface text-xl font-bold p-1"
              >
                âœ•
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-surface-subtle/50 text-xs">
              <div>
                <span className="text-on-surface-variant block font-medium">Workplace</span>
                <span className="font-semibold capitalize text-on-surface">{selectedJob.workplace_mode}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-medium">Location</span>
                <span className="font-semibold text-on-surface">{selectedJob.location || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-medium">Experience</span>
                <span className="font-semibold text-on-surface">
                  {selectedJob.experience_min ? `${selectedJob.experience_min}+ years` : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block font-medium">Salary</span>
                <span className="font-semibold text-on-surface">
                  {selectedJob.salary_min
                    ? `${selectedJob.salary_currency || '$'}${selectedJob.salary_min.toLocaleString()} - ${
                        selectedJob.salary_max?.toLocaleString() || 'DOE'
                      }`
                    : 'Not disclosed'}
                </span>
              </div>
            </div>

            {selectedJob.required_skills && selectedJob.required_skills.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-on-surface mb-2">Required Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.required_skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 text-xs rounded-lg bg-surface-subtle text-on-surface font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedJob.preferred_skills && selectedJob.preferred_skills.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-on-surface mb-2">Preferred Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.preferred_skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 text-xs rounded-lg bg-surface-subtle/70 text-on-surface-variant font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-on-surface mb-2">Job Description</h4>
              <div className="text-xs text-on-surface-variant whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto p-3 rounded-lg bg-surface-subtle/30 border border-surface-subtle">
                {selectedJob.job_description || 'No detailed description provided.'}
              </div>
            </div>

            <div className="pt-4 border-t border-surface-subtle flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleToggleSave(selectedJob)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
              >
                {selectedJob.is_saved ? 'â˜… Bookmarked' : 'â˜† Bookmark Job'}
              </button>
              {selectedJob.application_url && (
                <a
                  href={selectedJob.application_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Apply on Original Career Page â†—
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual / Extension Job Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface p-4">
          <form
            onSubmit={handleImportSubmit}
            className="bg-surface rounded-2xl max-w-lg w-full p-6 space-y-4 border border-surface-subtle shadow-soft"
          >
            <div className="flex items-center justify-between border-b border-surface-subtle pb-3">
              <h3 className="text-lg font-bold text-on-surface">Import Job Posting</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-lg font-bold"
              >
                âœ•
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-on-surface mb-1">Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Backend Engineer"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={importCompany}
                  onChange={(e) => setImportCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface mb-1">Application URL</label>
                <input
                  type="url"
                  placeholder="https://company.com/jobs/123"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-on-surface mb-1">Workplace Mode</label>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="office">Office / Onsite</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-on-surface mb-1">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Seattle, WA"
                    value={importLocation}
                    onChange={(e) => setImportLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-on-surface mb-1">Salary Range (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. $140,000 - $180,000 USD"
                  value={importSalary}
                  onChange={(e) => setImportSalary(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface mb-1">Job Description Text</label>
                <textarea
                  rows={4}
                  placeholder="Paste job description, requirements, or responsibilities here..."
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-subtle bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-subtle">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={importSubmitting}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {importSubmitting ? 'Importing...' : 'Normalize & Save Job'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
