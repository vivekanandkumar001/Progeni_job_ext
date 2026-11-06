'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  getApplicationDossier,
  updateApplicationTrackerStatus,
  scheduleInterview,
  scheduleFollowUp,
  launchProgeniSimulation,
  syncProgeniSimulation,
  listProgeniSimulations,
  type ApplicationDossierItem,
  type TrackerLifecycleStatus,
  type ProgeniSimulationRecord,
} from '../../../lib/api';

function DossierContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('id');

  const [dossier, setDossier] = useState<ApplicationDossierItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Schedule Interview Modal
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [interviewStage, setInterviewStage] = useState('technical_interview');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewMode, setInterviewMode] = useState('video');
  const [meetingLink, setMeetingLink] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [interviewerTitle, setInterviewerTitle] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [schedulingInterview, setSchedulingInterview] = useState(false);

  // Schedule Follow-up Modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);

  // Progeni Atlas AI Simulation State
  const [simulations, setSimulations] = useState<ProgeniSimulationRecord[]>([]);
  const [launchingSim, setLaunchingSim] = useState(false);
  const [syncingSimId, setSyncingSimId] = useState<string | null>(null);

  async function loadDossier() {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [dossierData, simsData] = await Promise.all([
        getApplicationDossier(applicationId),
        listProgeniSimulations(applicationId),
      ]);
      setDossier(dossierData);
      setSimulations(simsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load application dossier.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDossier();
  }, [applicationId]);

  async function handleLaunchSimulation() {
    if (!applicationId) return;
    setLaunchingSim(true);
    setError('');
    try {
      const res = await launchProgeniSimulation({
        applicationId,
      });
      setNotice(
        `Simulation launched in Progeni Atlas! Opening live room... (Session: ${res.sessionId})`,
      );
      if (res.targetUrl) {
        window.open(res.targetUrl, '_blank', 'noopener,noreferrer');
      }
      const updatedSims = await listProgeniSimulations(applicationId);
      setSimulations(updatedSims);
      await loadDossier();
    } catch (err: any) {
      setError(err.message || 'Failed to launch Progeni AI simulation.');
    } finally {
      setLaunchingSim(false);
    }
  }

  async function handleSyncSimulation(sessionId: string) {
    setSyncingSimId(sessionId);
    setError('');
    try {
      const updated = await syncProgeniSimulation(sessionId);
      setNotice(
        `Results synchronized! Overall score: ${updated.overallScore ?? 'N/A'}/100 • Recommendation: ${updated.hiringRecommendation ?? 'PENDING'}`,
      );
      setSimulations((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? updated : s)),
      );
      await loadDossier();
    } catch (err: any) {
      setError(err.message || 'Failed to sync simulation scorecard.');
    } finally {
      setSyncingSimId(null);
    }
  }

  async function handleTransition(targetStatus: TrackerLifecycleStatus) {
    if (!applicationId) return;
    try {
      await updateApplicationTrackerStatus(applicationId, targetStatus);
      setNotice(`Status moved to ${targetStatus.replace(/_/g, ' ')}`);
      await loadDossier();
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    }
  }

  async function handleCreateInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId) return;
    setSchedulingInterview(true);
    try {
      await scheduleInterview({
        applicationId,
        stage: interviewStage,
        scheduledAt: new Date(interviewDate).toISOString(),
        interviewMode,
        meetingLink: meetingLink || undefined,
        interviewerDetails: interviewerName
          ? { name: interviewerName, title: interviewerTitle || undefined }
          : undefined,
        preparationNotes: prepNotes || undefined,
      });
      setNotice('Interview scheduled successfully.');
      setShowInterviewModal(false);
      await loadDossier();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule interview.');
    } finally {
      setSchedulingInterview(false);
    }
  }

  async function handleCreateFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!applicationId) return;
    setSchedulingFollowUp(true);
    try {
      await scheduleFollowUp({
        applicationId,
        followUpDate,
        nextAction,
        contactDetails: contactName
          ? { name: contactName, email: contactEmail || undefined }
          : undefined,
      });
      setNotice('Follow-up task scheduled successfully.');
      setShowFollowUpModal(false);
      await loadDossier();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule follow-up.');
    } finally {
      setSchedulingFollowUp(false);
    }
  }

  if (!applicationId) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-on-surface-variant">No application ID provided in the URL query.</p>
        <Link
          href="/application-tracker"
          className="inline-block px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground"
        >
          ← Return to Application Tracker
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-12 text-center text-sm text-on-surface-variant">Loading application dossier...</div>;
  }

  if (!dossier) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-danger">Application dossier could not be found or access was denied.</p>
        <Link
          href="/application-tracker"
          className="inline-block px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface"
        >
          ← Back to Tracker
        </Link>
      </div>
    );
  }

  const app = dossier.application;
  const job = app.jobSnapshot || {};
  const evidence = dossier.submissionEvidence;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/application-tracker"
            className="text-xs text-primary hover:text-primary font-medium flex items-center gap-1 mb-1"
          >
            ← Back to Applications
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">
            {job.title || 'Job Position'}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {job.company || 'Company'} • {job.location || 'Remote'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dossier.allowedTransitions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">Move Status:</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    void handleTransition(e.target.value as TrackerLifecycleStatus);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-surface-subtle border border-outline text-on-surface rounded-lg focus:outline-none focus:border-primary/30"
              >
                <option value="">Select Next Status...</option>
                {dossier.allowedTransitions.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowInterviewModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition"
          >
            + Schedule Interview
          </button>
          <button
            onClick={() => setShowFollowUpModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 transition"
          >
            + Add Follow-Up
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

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-2">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            Current Lifecycle Status
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-on-surface uppercase">
              {app.status ? app.status.replace(/_/g, ' ') : 'DISCOVERED'}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Last updated {new Date(app.updated_at || app.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* Verification Card */}
        <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-2">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            Submission Verification
          </span>
          <div>
            {evidence ? (
              <span
                className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${ evidence.verificationStatus === 'verified' ? 'bg-success/10 text-success border border-success/30' : 'bg-warning/10 text-warning border border-warning/30' }`}
              >
                ✓ {evidence.verificationStatus.replace(/_/g, ' ').toUpperCase()}
              </span>
            ) : (
              <span className="text-on-surface-variant text-sm font-medium">Unsubmitted / In Progress</span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">
            {evidence?.confirmationReference
              ? `Ref: ${evidence.confirmationReference}`
              : 'Independent verification engine'}
          </p>
        </div>

        {/* Next Steps / Activity Card */}
        <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-2">
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            Next Action / Focus
          </span>
          <div className="text-sm font-semibold text-on-surface">
            {dossier.followUps.find((f) => f.status === 'pending')?.nextAction ||
              (dossier.interviews.some((i) => i.status === 'scheduled')
                ? 'Prepare for upcoming interview'
                : 'Maintain application monitoring')}
          </div>
          <p className="text-xs text-on-surface-variant">
            {dossier.interviews.filter((i) => i.status === 'scheduled').length} upcoming interview(s)
          </p>
        </div>
      </div>

      {/* Submission Evidence Detailed Panel */}
      {evidence && (
        <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-3">
          <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <span>🛡</span> Verified Submission Dossier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-on-surface-variant block">Method:</span>
              <span className="font-medium text-on-surface">
                {evidence.submissionMethod.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant block">Timestamp:</span>
              <span className="font-medium text-on-surface">
                {new Date(evidence.submittedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant block">Destination:</span>
              <a
                href={evidence.destination}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline truncate block"
              >
                {evidence.destination}
              </a>
            </div>
            <div>
              <span className="text-on-surface-variant block">Reference ID:</span>
              <span className="font-mono text-on-surface">
                {evidence.confirmationReference || 'None Provided'}
              </span>
            </div>
          </div>
          {evidence.notes && (
            <p className="text-xs text-on-surface-variant pt-1 border-t border-outline-variant">
              <span className="text-on-surface-variant font-medium">Notes:</span> {evidence.notes}
            </p>
          )}
        </div>
      )}

      {/* Two Column Layout: Interviews & Follow-ups on Left, Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Interviews & Follow-ups */}
        <div className="space-y-6">
          {/* Scheduled Interviews Card */}
          <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-on-surface">
                Interviews ({dossier.interviews.length})
              </h2>
              <button
                onClick={() => setShowInterviewModal(true)}
                className="text-xs text-primary hover:text-primary font-medium"
              >
                + New Stage
              </button>
            </div>

            {dossier.interviews.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No interview rounds scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {dossier.interviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-surface-subtle border border-outline space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-on-surface capitalize">
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${ item.status === 'completed' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary' }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
                      <span>⏰ {new Date(item.scheduledAt).toLocaleString()}</span>
                      <span>Mode: {item.interviewMode}</span>
                      {item.durationMinutes && <span>{item.durationMinutes} mins</span>}
                    </div>

                    {item.meetingLink && (
                      <div>
                        <a
                          href={item.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Join Meeting Link →
                        </a>
                      </div>
                    )}

                    {item.interviewerDetails?.name && (
                      <p className="text-on-surface-variant">
                        Interviewer: {item.interviewerDetails.name}{' '}
                        {item.interviewerDetails.title && `(${item.interviewerDetails.title})`}
                      </p>
                    )}

                    {item.preparationNotes && (
                      <p className="text-on-surface-variant bg-surface p-2 rounded border border-outline-variant">
                        <strong className="text-on-surface-variant">Notes:</strong> {item.preparationNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progeni Atlas AI Technical Simulation Card */}
          <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-on-surface">
                    AI Technical Simulation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    PROGENI ATLAS
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Pre-interview technical simulation grounded in this role&apos;s requirements.
                </p>
              </div>

              <button
                onClick={handleLaunchSimulation}
                disabled={launchingSim}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {launchingSim ? '⚡ Initializing...' : '🚀 Launch Practice Room'}
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[11px]">
              <span className="font-semibold">Zero-Hallucination Mock:</span> This simulation runs in Progeni Atlas with live AI proctoring, speech synthesis, and live coding. It provides practice feedback without altering official application decisions.
            </div>

            {simulations.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No practice simulations launched for this job yet. Click &quot;Launch Practice Room&quot; to test your technical interview readiness with live AI evaluation.
              </p>
            ) : (
              <div className="space-y-3">
                {simulations.map((sim) => (
                  <div
                    key={sim.id}
                    className="p-3.5 rounded-lg bg-surface-subtle border border-outline space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-on-surface">{sim.jobRole}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-surface-subtle text-on-surface-variant">
                            AI MOCK
                          </span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant">
                          Session: {sim.sessionId.slice(0, 8)}... • {new Date(sim.launchedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        {sim.overallScore !== undefined ? (
                          <div className="text-base font-bold text-success">
                            {sim.overallScore}
                            <span className="text-[10px] text-on-surface-variant">/100</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning border border-warning/20">
                            IN PROGRESS
                          </span>
                        )}
                        {sim.hiringRecommendation && (
                          <div className="text-[9px] font-bold uppercase text-success">
                            {sim.hiringRecommendation.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {sim.competencyPillars && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-surface p-2 rounded border border-outline-variant">
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Algorithms:</span>
                          <span className="text-on-surface-variant font-mono">
                            {sim.competencyPillars.algorithmicProblemSolving}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Architecture:</span>
                          <span className="text-on-surface-variant font-mono">
                            {sim.competencyPillars.systemArchitecture}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Code Quality:</span>
                          <span className="text-on-surface-variant font-mono">
                            {sim.competencyPillars.codeQualityAndSyntax}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Communication:</span>
                          <span className="text-on-surface-variant font-mono">
                            {sim.competencyPillars.communicationAndClarity}%
                          </span>
                        </div>
                      </div>
                    )}

                    {sim.executiveSummary && (
                      <p className="text-[11px] text-on-surface-variant line-clamp-2">
                        {sim.executiveSummary}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-outline text-[11px]">
                      <button
                        onClick={() => handleSyncSimulation(sim.sessionId)}
                        disabled={syncingSimId === sim.sessionId}
                        className="text-on-surface-variant hover:text-on-surface transition disabled:opacity-50"
                      >
                        {syncingSimId === sim.sessionId ? 'Syncing...' : '🔄 Sync Scorecard'}
                      </button>

                      <div className="flex items-center gap-2">
                        {sim.launchUrl && (
                          <a
                            href={sim.launchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-surface-variant hover:bg-surface-variant text-on-surface transition text-[10px]"
                          >
                            Live Room →
                          </a>
                        )}
                        <a
                          href={`http://localhost:3000/candidate/interview/${encodeURIComponent(sim.sessionId)}/report`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded bg-primary/30 hover:bg-primary/50 text-primary border border-primary/40 transition text-[10px] font-medium"
                        >
                          Dossier Report ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Tasks Card */}
          <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-on-surface">
                Follow-Up Tasks ({dossier.followUps.length})
              </h2>
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="text-xs text-primary hover:text-primary font-medium"
              >
                + New Follow-Up
              </button>
            </div>

            {dossier.followUps.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No pending follow-ups for this application.</p>
            ) : (
              <div className="space-y-3">
                {dossier.followUps.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-surface-subtle border border-outline space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-on-surface">{item.nextAction}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${ item.status === 'completed' ? 'bg-success/10 text-success' : item.isOverdue ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-warning/10 text-warning' }`}
                      >
                        {item.isOverdue ? 'OVERDUE' : item.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-on-surface-variant">Due: {item.followUpDate}</div>
                    {item.contactDetails?.name && (
                      <p className="text-on-surface-variant">
                        Contact: {item.contactDetails.name} ({item.contactDetails.email})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline Events */}
        <div className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4">
          <h2 className="text-base font-semibold text-on-surface">Chronological Audit Timeline</h2>
          {dossier.timeline.length === 0 ? (
            <p className="text-xs text-on-surface-variant">No timeline history recorded yet.</p>
          ) : (
            <div className="relative border-l border-outline-variant ml-3 space-y-6">
              {dossier.timeline.map((event) => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline bullet */}
                  <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-outline-variant bg-indigo-500" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface">{event.title}</span>
                      <span className="text-[10px] text-on-surface-variant">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{event.description}</p>
                    <span className="text-[10px] text-on-surface-variant block">Actor: {event.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Schedule Interview */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-card space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Schedule Interview Round</h3>
            <form onSubmit={handleCreateInterview} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Interview Stage</label>
                <select
                  value={interviewStage}
                  onChange={(e) => setInterviewStage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                >
                  <option value="hr_screening">HR Screening</option>
                  <option value="technical_interview">Technical Interview</option>
                  <option value="coding_assessment">Coding Assessment</option>
                  <option value="managerial_interview">Managerial Interview</option>
                  <option value="final_interview">Final Interview</option>
                  <option value="other">Other Round</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Scheduled Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Mode</label>
                  <select
                    value={interviewMode}
                    onChange={(e) => setInterviewMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                  >
                    <option value="video">Video Call</option>
                    <option value="phone">Phone Screen</option>
                    <option value="in_person">In-Person</option>
                    <option value="take_home">Take Home Assessment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://zoom.us/..."
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Interviewer Name</label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Preparation Notes</label>
                <textarea
                  rows={2}
                  value={prepNotes}
                  onChange={(e) => setPrepNotes(e.target.value)}
                  placeholder="Key talking points or areas to review..."
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInterviewModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingInterview}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {schedulingInterview ? 'Saving...' : 'Save Interview'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Follow-Up */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-card space-y-4">
            <h3 className="text-lg font-bold text-on-surface">Schedule Follow-Up Task</h3>
            <form onSubmit={handleCreateFollowUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Follow-Up Date (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">Next Action *</label>
                <input
                  type="text"
                  required
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Inquire on status via recruiter email"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Recruiter Name"
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingFollowUp}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-warning hover:bg-warning/90 text-white"
                >
                  {schedulingFollowUp ? 'Saving...' : 'Save Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApplicationDetailsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-on-surface-variant">Loading...</div>}>
      <DossierContent />
    </Suspense>
  );
}
