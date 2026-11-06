'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listTrackedApplications,
  updateApplicationTrackerStatus,
  recordApplicationSubmissionEvidence,
  type TrackedAppSummary,
  type TrackerLifecycleStatus,
} from '../../../lib/api';

const STATUS_FILTERS = [
  { key: 'all', label: 'All Applications' },
  { key: 'discovered', label: 'Discovered' },
  { key: 'preparing,ready_for_review,approved', label: 'In Preparation' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review,shortlisted', label: 'In Review' },
  { key: 'interview_scheduled', label: 'Interviews' },
  { key: 'offer_received,offer_accepted,offer_declined', label: 'Offers' },
  { key: 'rejected,withdrawn,closed', label: 'Archived / Closed' },
];

export default function ApplicationTrackerPage() {
  const [applications, setApplications] = useState<TrackedAppSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [busyId, setBusyId] = useState('');

  // Submission Evidence Modal State
  const [evidenceModalApp, setEvidenceModalApp] = useState<TrackedAppSummary | null>(null);
  const [destUrl, setDestUrl] = useState('');
  const [subMethod, setSubMethod] = useState<'manual' | 'extension_assisted' | 'direct_api' | 'portal'>('portal');
  const [confRef, setConfRef] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [evidenceSnippet, setEvidenceSnippet] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await listTrackedApplications({
        q: searchQuery || undefined,
        status: activeFilter === 'all' ? undefined : activeFilter,
        limit: 50,
      });
      setApplications(res.applications || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracked applications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeFilter]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void loadData();
  }

  async function handleStatusChange(app: TrackedAppSummary, targetStatus: TrackerLifecycleStatus) {
    if (targetStatus === 'submitted' && !app.submissionEvidence) {
      // Open submission evidence modal instead of direct blind change
      openEvidenceModal(app);
      return;
    }

    setBusyId(app.id);
    setError('');
    setNotice('');
    try {
      await updateApplicationTrackerStatus(app.id, targetStatus);
      setNotice(`Application updated to ${targetStatus.replace('_', ' ')}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Status transition rejected.');
    } finally {
      setBusyId('');
    }
  }

  function openEvidenceModal(app: TrackedAppSummary) {
    setEvidenceModalApp(app);
    setDestUrl(app.jobUrl || 'https://');
    setConfRef('');
    setSubNotes('');
    setEvidenceSnippet('');
  }

  async function submitEvidenceForm(e: React.FormEvent) {
    e.preventDefault();
    if (!evidenceModalApp) return;

    setSubmittingEvidence(true);
    setError('');
    try {
      await recordApplicationSubmissionEvidence(evidenceModalApp.id, {
        destination: destUrl,
        submissionMethod: subMethod,
        confirmationReference: confRef || undefined,
        notes: subNotes || undefined,
        confirmationEvidence: evidenceSnippet
          ? {
              type: 'confirmation_text',
              value: evidenceSnippet,
              submittedAt: new Date().toISOString(),
            }
          : undefined,
      });

      setNotice(`Verified submission recorded for ${evidenceModalApp.company}.`);
      setEvidenceModalApp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to record submission evidence.');
    } finally {
      setSubmittingEvidence(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
      case 'verified':
        return 'bg-info/10 text-info border-info/20';
      case 'interview_scheduled':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'offer_received':
      case 'offer_accepted':
        return 'bg-success/10 text-success border-success/20';
      case 'rejected':
      case 'closed':
        return 'bg-surface-subtle text-on-surface-variant border-outline';
      case 'approved':
        return 'bg-warning/10 text-warning border-warning/20';
      default:
        return 'bg-surface-subtle text-on-surface-variant border-outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Application Tracker</h1>
          <p className="text-sm text-on-surface-variant">
            Real-time multi-stage lifecycle, submission evidence verification, and interview pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/interview-center"
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-outline transition"
          >
            🗓 Interview Center
          </Link>
          <Link
            href="/follow-up-manager"
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-outline transition"
          >
            ⏰ Follow-Up Tasks
          </Link>
          <Link
            href="/performance-analytics"
            className="px-3.5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            📈 Performance Analytics
          </Link>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-success/10 border border-success/20 text-success text-sm flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-xs text-success hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-xs text-danger hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-surface border border-outline-variant rounded-xl">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ activeFilter === f.key ? 'bg-surface-subtle text-on-surface shadow-sm border border-outline' : 'text-on-surface-variant hover:text-on-surface' }`}}
            >
              {f.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, title, or destination..."
            className="px-3 py-1.5 text-xs bg-surface border border-outline-variant rounded-lg text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:border-primary/30 w-64"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-medium bg-surface-subtle hover:bg-surface-variant text-on-surface rounded-lg border border-outline transition"
          >
            Search
          </button>
        </form>
      </div>

      {/* Applications Table / Cards */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">Loading tracked applications...</div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-on-surface-variant text-sm">No applications found in this view.</p>
            <Link
              href="/job-recommendations"
              className="inline-block px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
            >
              Explore Job Postings
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface transition"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-on-surface text-base">{app.jobTitle}</span>
                    <span className="text-on-surface-variant text-sm">at</span>
                    <span className="text-on-surface font-medium text-sm">{app.company}</span>
                    {app.location && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-subtle text-on-surface-variant border border-outline">
                        {app.location}
                      </span>
                    )}
                    {app.source && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-subtle text-on-surface-variant">
                        {app.source}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusColor( app.status, )}`}}
                    >
                      {app.status.replace(/_/g, ' ').toUpperCase()}
                    </span>

                    {/* Submission Evidence Badge */}
                    {app.submissionEvidence ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${ app.submissionEvidence.verificationStatus === 'verified' ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20' }`}}
                        title={
                          app.submissionEvidence.confirmationReference
                            ? `Ref: ${app.submissionEvidence.confirmationReference}`
                            : 'Candidate Reported'
                        }
                      >
                        ✓ {app.submissionEvidence.verificationStatus.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant text-xs">Unsubmitted</span>
                    )}

                    {/* Interviews count */}
                    {app.interviewsCount > 0 && (
                      <span className="text-primary font-medium">
                        🗓 {app.interviewsCount} interview{app.interviewsCount > 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Follow-up indicators */}
                    {app.pendingFollowUpsCount > 0 && (
                      <span
                        className={
                          app.hasOverdueFollowUp
                            ? 'text-danger font-semibold flex items-center gap-1'
                            : 'text-warning font-medium'
                        }
                      >
                        ⏰ {app.pendingFollowUpsCount} follow-up{app.pendingFollowUpsCount > 1 ? 's' : ''}
                        {app.hasOverdueFollowUp && ' (OVERDUE)'}
                      </span>
                    )}

                    <span className="text-on-surface-variant">
                      Updated {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Submission Evidence Button */}
                  {app.status !== 'submitted' && app.status !== 'verified' && (
                    <button
                      onClick={() => openEvidenceModal(app)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-info/20 hover:bg-info/30 text-info border border-info/30 transition"
                    >
                      Confirm Submission
                    </button>
                  )}

                  {/* Quick status dropdown */}
                  {app.allowedTransitions.length > 0 && (
                    <select
                      value=""
                      disabled={busyId === app.id}
                      onChange={(e) => {
                        if (e.target.value) {
                          void handleStatusChange(app, e.target.value as TrackerLifecycleStatus);
                        }
                      }}
                      className="px-2.5 py-1.5 text-xs bg-surface-subtle border border-outline text-on-surface-variant rounded-lg focus:outline-none focus:border-primary/30 cursor-pointer"
                    >
                      <option value="">Move Status →</option>
                      {app.allowedTransitions.map((target) => (
                        <option key={target} value={target}>
                          {target.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  )}

                  <Link
                    href={`/application-details?id=${encodeURIComponent(app.id)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-outline transition"
                  >
                    View Dossier →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submission Evidence Modal */}
      {evidenceModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Record Submission Evidence</h3>
                <p className="text-xs text-on-surface-variant">
                  {evidenceModalApp.jobTitle} at {evidenceModalApp.company}
                </p>
              </div>
              <button
                onClick={() => setEvidenceModalApp(null)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitEvidenceForm} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Submission Destination URL *
                </label>
                <input
                  type="url"
                  required
                  value={destUrl}
                  onChange={(e) => setDestUrl(e.target.value)}
                  placeholder="https://company.careers.com/submit/12345"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Submission Method
                  </label>
                  <select
                    value={subMethod}
                    onChange={(e: any) => setSubMethod(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                  >
                    <option value="portal">Career Portal</option>
                    <option value="direct_api">Direct ATS API</option>
                    <option value="extension_assisted">Extension Assisted</option>
                    <option value="manual">Manual Submission</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Confirmation Reference Code
                  </label>
                  <input
                    type="text"
                    value={confRef}
                    onChange={(e) => setConfRef(e.target.value)}
                    placeholder="e.g. APP-98234 or Req-123"
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Confirmation Text / Email Snippet
                </label>
                <textarea
                  rows={3}
                  value={evidenceSnippet}
                  onChange={(e) => setEvidenceSnippet(e.target.value)}
                  placeholder="Paste confirmation email snippet or confirmation screen text..."
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  placeholder="Optional internal notes"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEvidenceModalApp(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant hover:bg-surface-variant transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEvidence}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50"
                >
                  {submittingEvidence ? 'Recording...' : 'Verify & Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Non-Guarantee Regulatory Disclaimer */}
      <div className="p-4 rounded-xl bg-surface border border-outline-variant text-xs text-on-surface-variant leading-relaxed">
        <strong className="text-on-surface-variant">Important Disclaimer:</strong> Auto Apply AI provides candidate-assisted tracking, readiness verification, and submission intelligence tools. Recording an application or marking it as submitted does not constitute an employment offer, interview invitation, or guarantee of hiring consideration by the employer.
      </div>
    </div>
  );
}
