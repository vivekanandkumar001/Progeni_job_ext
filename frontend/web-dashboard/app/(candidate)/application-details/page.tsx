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
        <p className="text-zinc-400">No application ID provided in the URL query.</p>
        <Link
          href="/application-tracker"
          className="inline-block px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white"
        >
          ← Return to Application Tracker
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-12 text-center text-sm text-zinc-400">Loading application dossier...</div>;
  }

  if (!dossier) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-rose-400">Application dossier could not be found or access was denied.</p>
        <Link
          href="/application-tracker"
          className="inline-block px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-200"
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
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 mb-1"
          >
            ← Back to Applications
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            {job.title || 'Job Position'}
          </h1>
          <p className="text-sm text-zinc-400">
            {job.company || 'Company'} • {job.location || 'Remote'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dossier.allowedTransitions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Move Status:</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    void handleTransition(e.target.value as TrackerLifecycleStatus);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg focus:outline-none focus:border-indigo-500"
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
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition"
          >
            + Schedule Interview
          </button>
          <button
            onClick={() => setShowFollowUpModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition"
          >
            + Add Follow-Up
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

      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Current Lifecycle Status
          </span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-zinc-100 uppercase">
              {app.status ? app.status.replace(/_/g, ' ') : 'DISCOVERED'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Last updated {new Date(app.updated_at || app.updatedAt).toLocaleString()}
          </p>
        </div>

        {/* Verification Card */}
        <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Submission Verification
          </span>
          <div>
            {evidence ? (
              <span
                className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${
                  evidence.verificationStatus === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                }`}
              >
                ✓ {evidence.verificationStatus.replace(/_/g, ' ').toUpperCase()}
              </span>
            ) : (
              <span className="text-zinc-500 text-sm font-medium">Unsubmitted / In Progress</span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {evidence?.confirmationReference
              ? `Ref: ${evidence.confirmationReference}`
              : 'Independent verification engine'}
          </p>
        </div>

        {/* Next Steps / Activity Card */}
        <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Next Action / Focus
          </span>
          <div className="text-sm font-semibold text-zinc-200">
            {dossier.followUps.find((f) => f.status === 'pending')?.nextAction ||
              (dossier.interviews.some((i) => i.status === 'scheduled')
                ? 'Prepare for upcoming interview'
                : 'Maintain application monitoring')}
          </div>
          <p className="text-xs text-zinc-500">
            {dossier.interviews.filter((i) => i.status === 'scheduled').length} upcoming interview(s)
          </p>
        </div>
      </div>

      {/* Submission Evidence Detailed Panel */}
      {evidence && (
        <div className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <span>🛡</span> Verified Submission Dossier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-zinc-500 block">Method:</span>
              <span className="font-medium text-zinc-200">
                {evidence.submissionMethod.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Timestamp:</span>
              <span className="font-medium text-zinc-200">
                {new Date(evidence.submittedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Destination:</span>
              <a
                href={evidence.destination}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-indigo-400 hover:underline truncate block"
              >
                {evidence.destination}
              </a>
            </div>
            <div>
              <span className="text-zinc-500 block">Reference ID:</span>
              <span className="font-mono text-zinc-200">
                {evidence.confirmationReference || 'None Provided'}
              </span>
            </div>
          </div>
          {evidence.notes && (
            <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
              <span className="text-zinc-500 font-medium">Notes:</span> {evidence.notes}
            </p>
          )}
        </div>
      )}

      {/* Two Column Layout: Interviews & Follow-ups on Left, Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Interviews & Follow-ups */}
        <div className="space-y-6">
          {/* Scheduled Interviews Card */}
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">
                Interviews ({dossier.interviews.length})
              </h2>
              <button
                onClick={() => setShowInterviewModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                + New Stage
              </button>
            </div>

            {dossier.interviews.length === 0 ? (
              <p className="text-xs text-zinc-500">No interview rounds scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                {dossier.interviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 capitalize">
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
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
                          className="text-indigo-400 hover:underline"
                        >
                          Join Meeting Link →
                        </a>
                      </div>
                    )}

                    {item.interviewerDetails?.name && (
                      <p className="text-zinc-400">
                        Interviewer: {item.interviewerDetails.name}{' '}
                        {item.interviewerDetails.title && `(${item.interviewerDetails.title})`}
                      </p>
                    )}

                    {item.preparationNotes && (
                      <p className="text-zinc-400 bg-zinc-900/60 p-2 rounded border border-zinc-800">
                        <strong className="text-zinc-300">Notes:</strong> {item.preparationNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progeni Atlas AI Technical Simulation Card */}
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-100">
                    AI Technical Simulation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    PROGENI ATLAS
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Pre-interview technical simulation grounded in this role&apos;s requirements.
                </p>
              </div>

              <button
                onClick={handleLaunchSimulation}
                disabled={launchingSim}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                {launchingSim ? '⚡ Initializing...' : '🚀 Launch Practice Room'}
              </button>
            </div>

            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]">
              <span className="font-semibold">Zero-Hallucination Mock:</span> This simulation runs in Progeni Atlas with live AI proctoring, speech synthesis, and live coding. It provides practice feedback without altering official application decisions.
            </div>

            {simulations.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No practice simulations launched for this job yet. Click &quot;Launch Practice Room&quot; to test your technical interview readiness with live AI evaluation.
              </p>
            ) : (
              <div className="space-y-3">
                {simulations.map((sim) => (
                  <div
                    key={sim.id}
                    className="p-3.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-zinc-200">{sim.jobRole}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400">
                            AI MOCK
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Session: {sim.sessionId.slice(0, 8)}... • {new Date(sim.launchedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        {sim.overallScore !== undefined ? (
                          <div className="text-base font-bold text-emerald-400">
                            {sim.overallScore}
                            <span className="text-[10px] text-zinc-500">/100</span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            IN PROGRESS
                          </span>
                        )}
                        {sim.hiringRecommendation && (
                          <div className="text-[9px] font-bold uppercase text-emerald-300">
                            {sim.hiringRecommendation.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {sim.competencyPillars && (
                      <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-900/60 p-2 rounded border border-zinc-800">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Algorithms:</span>
                          <span className="text-zinc-300 font-mono">
                            {sim.competencyPillars.algorithmicProblemSolving}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Architecture:</span>
                          <span className="text-zinc-300 font-mono">
                            {sim.competencyPillars.systemArchitecture}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Code Quality:</span>
                          <span className="text-zinc-300 font-mono">
                            {sim.competencyPillars.codeQualityAndSyntax}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Communication:</span>
                          <span className="text-zinc-300 font-mono">
                            {sim.competencyPillars.communicationAndClarity}%
                          </span>
                        </div>
                      </div>
                    )}

                    {sim.executiveSummary && (
                      <p className="text-[11px] text-zinc-300 line-clamp-2">
                        {sim.executiveSummary}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-700/60 text-[11px]">
                      <button
                        onClick={() => handleSyncSimulation(sim.sessionId)}
                        disabled={syncingSimId === sim.sessionId}
                        className="text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
                      >
                        {syncingSimId === sim.sessionId ? 'Syncing...' : '🔄 Sync Scorecard'}
                      </button>

                      <div className="flex items-center gap-2">
                        {sim.launchUrl && (
                          <a
                            href={sim.launchUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition text-[10px]"
                          >
                            Live Room →
                          </a>
                        )}
                        <a
                          href={`http://localhost:3000/candidate/interview/${encodeURIComponent(sim.sessionId)}/report`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition text-[10px] font-medium"
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
          <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100">
                Follow-Up Tasks ({dossier.followUps.length})
              </h2>
              <button
                onClick={() => setShowFollowUpModal(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                + New Follow-Up
              </button>
            </div>

            {dossier.followUps.length === 0 ? (
              <p className="text-xs text-zinc-500">No pending follow-ups for this application.</p>
            ) : (
              <div className="space-y-3">
                {dossier.followUps.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200">{item.nextAction}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.isOverdue
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {item.isOverdue ? 'OVERDUE' : item.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-zinc-400">Due: {item.followUpDate}</div>
                    {item.contactDetails?.name && (
                      <p className="text-zinc-400">
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
        <div className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4">
          <h2 className="text-base font-semibold text-zinc-100">Chronological Audit Timeline</h2>
          {dossier.timeline.length === 0 ? (
            <p className="text-xs text-zinc-500">No timeline history recorded yet.</p>
          ) : (
            <div className="relative border-l border-zinc-800 ml-3 space-y-6">
              {dossier.timeline.map((event) => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline bullet */}
                  <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-zinc-900 bg-indigo-500" />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{event.title}</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{event.description}</p>
                    <span className="text-[10px] text-zinc-600 block">Actor: {event.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Schedule Interview */}
      {showInterviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">Schedule Interview Round</h3>
            <form onSubmit={handleCreateInterview} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Interview Stage</label>
                <select
                  value={interviewStage}
                  onChange={(e) => setInterviewStage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Scheduled Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Mode</label>
                  <select
                    value={interviewMode}
                    onChange={(e) => setInterviewMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  >
                    <option value="video">Video Call</option>
                    <option value="phone">Phone Screen</option>
                    <option value="in_person">In-Person</option>
                    <option value="take_home">Take Home Assessment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://zoom.us/..."
                    className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Interviewer Name</label>
                <input
                  type="text"
                  value={interviewerName}
                  onChange={(e) => setInterviewerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Preparation Notes</label>
                <textarea
                  rows={2}
                  value={prepNotes}
                  onChange={(e) => setPrepNotes(e.target.value)}
                  placeholder="Key talking points or areas to review..."
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInterviewModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingInterview}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">Schedule Follow-Up Task</h3>
            <form onSubmit={handleCreateFollowUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Follow-Up Date (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Next Action *</label>
                <input
                  type="text"
                  required
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Inquire on status via recruiter email"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Recruiter Name"
                    className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingFollowUp}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white"
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
    <Suspense fallback={<div className="p-12 text-center text-sm text-zinc-400">Loading...</div>}>
      <DossierContent />
    </Suspense>
  );
}
