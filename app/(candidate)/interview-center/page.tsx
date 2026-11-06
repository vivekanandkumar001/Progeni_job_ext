'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listInterviews,
  updateInterview,
  launchProgeniSimulation,
  syncProgeniSimulation,
  listProgeniSimulations,
  type InterviewItem,
  type ProgeniSimulationRecord,
} from '../../../lib/api';

const STAGES = [
  { key: 'all', label: 'All Rounds' },
  { key: 'hr_screening', label: 'HR Screening' },
  { key: 'technical_interview', label: 'Technical' },
  { key: 'coding_assessment', label: 'Coding Assessment' },
  { key: 'managerial_interview', label: 'Managerial' },
  { key: 'final_interview', label: 'Final Round' },
];

export default function InterviewCenterPage() {
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [simulations, setSimulations] = useState<ProgeniSimulationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeStage, setActiveStage] = useState('all');
  const [viewMode, setViewMode] = useState<'agenda' | 'pipeline'>('agenda');

  // Feedback Modal
  const [feedbackInterview, setFeedbackInterview] = useState<InterviewItem | null>(null);
  const [rating, setRating] = useState(5);
  const [strengths, setStrengths] = useState('');
  const [areasToImprove, setAreasToImprove] = useState('');
  const [questionsAsked, setQuestionsAsked] = useState('');
  const [overallImpression, setOverallImpression] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Progeni Atlas AI Simulation State
  const [showSimModal, setShowSimModal] = useState(false);
  const [customSimRole, setCustomSimRole] = useState('');
  const [customSimJd, setCustomSimJd] = useState('');
  const [launchingSimId, setLaunchingSimId] = useState<string | null>(null);
  const [syncingSimId, setSyncingSimId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [interviewsData, simsData] = await Promise.all([
        listInterviews({
          stage: activeStage === 'all' ? undefined : activeStage,
        }),
        listProgeniSimulations(),
      ]);
      setInterviews(interviewsData);
      setSimulations(simsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load interviews or practice simulations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeStage]);

  async function handleLaunchSimulation(item?: InterviewItem) {
    const key = item?.id || 'custom';
    setLaunchingSimId(key);
    setError('');
    try {
      const res = await launchProgeniSimulation({
        applicationId: item?.applicationId,
        interviewId: item?.id,
        customRole: !item ? customSimRole : undefined,
        customJd: !item ? customSimJd : undefined,
      });

      setNotice(
        `Simulation launched in Progeni Atlas! Opening live room... (Session: ${res.sessionId})`,
      );
      if (res.targetUrl) {
        window.open(res.targetUrl, '_blank', 'noopener,noreferrer');
      }
      setShowSimModal(false);
      setCustomSimRole('');
      setCustomSimJd('');
      // Reload simulations
      const updatedSims = await listProgeniSimulations();
      setSimulations(updatedSims);
    } catch (err: any) {
      setError(err.message || 'Failed to launch Progeni AI simulation.');
    } finally {
      setLaunchingSimId(null);
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
    } catch (err: any) {
      setError(err.message || 'Failed to sync simulation scorecard.');
    } finally {
      setSyncingSimId(null);
    }
  }

  function openFeedbackModal(item: InterviewItem) {
    setFeedbackInterview(item);
    setRating(item.feedback?.rating || 5);
    setStrengths(item.feedback?.strengths?.join('\n') || '');
    setAreasToImprove(item.feedback?.areasToImprove?.join('\n') || '');
    setQuestionsAsked(item.feedback?.questionsAsked?.join('\n') || '');
    setOverallImpression(item.feedback?.overallImpression || '');
  }

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedbackInterview) return;

    setSubmittingFeedback(true);
    try {
      await updateInterview(feedbackInterview.id, {
        status: 'completed',
        feedback: {
          rating,
          strengths: strengths.split('\n').map((s) => s.trim()).filter(Boolean),
          areasToImprove: areasToImprove.split('\n').map((s) => s.trim()).filter(Boolean),
          questionsAsked: questionsAsked.split('\n').map((s) => s.trim()).filter(Boolean),
          overallImpression,
        },
      });
      setNotice(`Interview feedback recorded for ${feedbackInterview.company}.`);
      setFeedbackInterview(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to record feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  }

  const upcomingInterviews = interviews.filter((i) => i.status === 'scheduled');
  const pastInterviews = interviews.filter((i) => i.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Interview Pipeline</h1>
          <p className="text-sm text-on-surface-variant">
            Track interview rounds, practice with Progeni Atlas AI simulation, and record evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSimModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition"
          >
            ⚡ Practice with Progeni Atlas AI
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'agenda' ? 'pipeline' : 'agenda')}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface border border-outline hover:bg-surface-variant transition"
          >
            Switch to {viewMode === 'agenda' ? 'Pipeline Board' : 'Agenda View'}
          </button>
          <Link
            href="/application-tracker"
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            ← Application Tracker
          </Link>
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ activeStage === s.key ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface border border-outline-variant text-on-surface-variant hover:text-on-surface' }`}}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-on-surface-variant">Loading interview rounds...</div>
      ) : interviews.length === 0 ? (
        <div className="p-12 text-center bg-surface border border-outline-variant rounded-xl space-y-3">
          <p className="text-on-surface-variant text-sm">No interviews found for this selection.</p>
          <p className="text-xs text-on-surface-variant">
            Schedule an interview from an application dossier or start a technical practice simulation above.
          </p>
        </div>
      ) : viewMode === 'agenda' ? (
        /* Agenda View */
        <div className="space-y-6">
          {/* Upcoming Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
              Upcoming Rounds ({upcomingInterviews.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingInterviews.map((item) => (
                <div
                  key={item.id}
                  className="p-5 bg-surface border border-outline-variant rounded-xl space-y-3 relative hover:border-outline transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-primary uppercase">
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-base font-bold text-on-surface">{item.company}</h3>
                      <p className="text-xs text-on-surface-variant">{item.jobTitle}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      SCHEDULED
                    </span>
                  </div>

                  <div className="text-xs text-on-surface-variant space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant">Date & Time:</span>
                      <span className="font-medium text-on-surface">
                        {new Date(item.scheduledAt).toLocaleString()} ({item.timezone})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant">Duration:</span>
                      <span>{item.durationMinutes} minutes ({item.interviewMode})</span>
                    </div>
                    {item.interviewerDetails?.name && (
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface-variant">Interviewer:</span>
                        <span>
                          {item.interviewerDetails.name}{' '}
                          {item.interviewerDetails.title && `(${item.interviewerDetails.title})`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2">
                    {item.meetingLink && (
                      <a
                        href={item.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
                      >
                        🎥 Open Video Meeting →
                      </a>
                    )}
                    <button
                      onClick={() => handleLaunchSimulation(item)}
                      disabled={launchingSimId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/30 hover:bg-primary/50 text-primary border border-primary/40 text-xs font-medium transition disabled:opacity-50"
                    >
                      {launchingSimId === item.id ? '⚡ Launching...' : '🤖 Practice AI Simulation (Progeni)'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                    <Link
                      href={`/application-details?id=${encodeURIComponent(item.applicationId)}`}
                      className="text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      View Dossier →
                    </Link>
                    <button
                      onClick={() => openFeedbackModal(item)}
                      className="px-3 py-1 text-xs font-medium rounded bg-success/20 hover:bg-success/30 text-success border border-success/30 transition"
                    >
                      ✓ Complete & Log Feedback
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Past / Completed Section */}
          {pastInterviews.length > 0 && (
            <div className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Completed Rounds ({pastInterviews.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 bg-surface border border-outline-variant rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium text-on-surface-variant uppercase">
                          {item.stage.replace(/_/g, ' ')}
                        </span>
                        <h3 className="text-base font-semibold text-on-surface">{item.company}</h3>
                        <p className="text-xs text-on-surface-variant">{item.jobTitle}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-success/10 text-success border border-success/20">
                        COMPLETED
                      </span>
                    </div>

                    {item.feedback?.rating && (
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <span>Rating: {'★'.repeat(item.feedback.rating)}{'☆'.repeat(5 - item.feedback.rating)}</span>
                        <span className="text-on-surface-variant">({item.feedback.rating}/5)</span>
                      </div>
                    )}

                    {item.feedback?.overallImpression && (
                      <p className="text-xs text-on-surface-variant italic bg-surface-subtle p-2.5 rounded border border-outline">
                        &ldquo;{item.feedback.overallImpression}&rdquo;
                      </p>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => openFeedbackModal(item)}
                        className="text-xs text-primary hover:underline"
                      >
                        Edit Feedback
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pipeline Kanban View */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { key: 'hr_screening', label: 'HR Screening' },
            { key: 'technical_interview', label: 'Technical' },
            { key: 'coding_assessment', label: 'Coding Assessment' },
            { key: 'managerial_interview', label: 'Managerial' },
            { key: 'final_interview', label: 'Final Round' },
          ].map((col) => {
            const colItems = interviews.filter((i) => i.stage === col.key);
            return (
              <div key={col.key} className="bg-surface border border-outline-variant rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                  <span className="text-xs font-semibold text-on-surface-variant">{col.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-subtle text-on-surface-variant">
                    {colItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-surface-subtle border border-outline text-xs space-y-1.5 shadow-sm"
                    >
                      <div className="font-semibold text-on-surface">{item.company}</div>
                      <div className="text-[11px] text-on-surface-variant truncate">{item.jobTitle}</div>
                      <div className="text-[10px] text-primary">
                        {new Date(item.scheduledAt).toLocaleDateString()}
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={() => handleLaunchSimulation(item)}
                          disabled={launchingSimId === item.id}
                          className="text-[10px] text-primary hover:underline"
                        >
                          {launchingSimId === item.id ? 'Launching...' : '🤖 Simulation'}
                        </button>
                        <button
                          onClick={() => openFeedbackModal(item)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Feedback →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Progeni Atlas AI Practice Simulations Section */}
      <div className="space-y-4 pt-6 border-t border-outline-variant">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
                Progeni Atlas AI Practice Simulations ({simulations.length})
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                INTEGRATED PLATFORM
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Technical mock interview simulations with live code execution, real-time transcription, and objective grading.
              <span className="text-warning font-medium ml-1">
                * Evaluated by Progeni Atlas AI simulation engine (Mock practice only).
              </span>
            </p>
          </div>

          <button
            onClick={() => setShowSimModal(true)}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 transition"
          >
            + New Practice Session
          </button>
        </div>

        {simulations.length === 0 ? (
          <div className="p-8 text-center bg-surface border border-outline-variant rounded-xl space-y-2">
            <p className="text-xs text-on-surface-variant">No practice simulations launched yet.</p>
            <p className="text-[11px] text-on-surface-variant">
              Launch a simulation for an upcoming interview round or practice on demand to sharpen your technical readiness.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="p-5 bg-surface border border-outline-variant rounded-xl space-y-4 hover:border-outline transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">{sim.companyName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-surface-subtle text-on-surface-variant uppercase">
                        AI Simulation
                      </span>
                    </div>
                    <p className="text-xs text-primary font-medium">{sim.jobRole}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      Launched: {new Date(sim.launchedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right">
                    {sim.overallScore !== undefined ? (
                      <div className="text-lg font-bold text-success">
                        {sim.overallScore}
                        <span className="text-xs text-on-surface-variant">/100</span>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning border border-warning/20">
                        IN PROGRESS
                      </span>
                    )}
                    {sim.hiringRecommendation && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-success/10 text-success border border-success/30">
                        {sim.hiringRecommendation.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pillars */}
                {sim.competencyPillars && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-surface-subtle p-2.5 rounded-lg border border-outline">
                    <div>
                      <div className="text-on-surface-variant flex justify-between">
                        <span>Algorithms:</span>
                        <span className="text-on-surface-variant font-mono font-medium">
                          {sim.competencyPillars.algorithmicProblemSolving}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full"
                          style={{ width: `${sim.competencyPillars.algorithmicProblemSolving}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-on-surface-variant flex justify-between">
                        <span>Architecture:</span>
                        <span className="text-on-surface-variant font-mono font-medium">
                          {sim.competencyPillars.systemArchitecture}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full"
                          style={{ width: `${sim.competencyPillars.systemArchitecture}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-on-surface-variant flex justify-between">
                        <span>Code Quality:</span>
                        <span className="text-on-surface-variant font-mono font-medium">
                          {sim.competencyPillars.codeQualityAndSyntax}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${sim.competencyPillars.codeQualityAndSyntax}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-on-surface-variant flex justify-between">
                        <span>Communication:</span>
                        <span className="text-on-surface-variant font-mono font-medium">
                          {sim.competencyPillars.communicationAndClarity}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full"
                          style={{ width: `${sim.competencyPillars.communicationAndClarity}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {sim.executiveSummary && (
                  <p className="text-xs text-on-surface-variant line-clamp-2">
                    {sim.executiveSummary}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant text-xs">
                  <button
                    onClick={() => handleSyncSimulation(sim.sessionId)}
                    disabled={syncingSimId === sim.sessionId}
                    className="text-on-surface-variant hover:text-on-surface transition disabled:opacity-50"
                  >
                    {syncingSimId === sim.sessionId ? 'Syncing...' : '🔄 Sync Results'}
                  </button>

                  <div className="flex items-center gap-2">
                    {sim.launchUrl && (
                      <a
                        href={sim.launchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-surface-subtle hover:bg-surface-variant text-on-surface-variant transition text-[11px]"
                      >
                        Live Room →
                      </a>
                    )}
                    <a
                      href={`http://localhost:3000/candidate/interview/${encodeURIComponent(sim.sessionId)}/report`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-primary/30 hover:bg-primary/50 text-primary border border-primary/40 transition text-[11px] font-medium"
                    >
                      Progeni Dossier ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Log Feedback */}
      {feedbackInterview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Post-Interview Evaluation</h3>
                <p className="text-xs text-on-surface-variant">
                  {feedbackInterview.company} • {feedbackInterview.stage.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => setFeedbackInterview(null)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Overall Signal Rating (1 - 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-xl ${rating >= star ? 'text-warning' : 'text-on-surface-variant'}`}}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-on-surface-variant ml-2">({rating}/5 stars)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Key Strengths Observed (One per line)
                </label>
                <textarea
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="e.g. Explained distributed consensus clearly&#10;Good culture alignment"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Areas to Polish / Review (One per line)
                </label>
                <textarea
                  rows={2}
                  value={areasToImprove}
                  onChange={(e) => setAreasToImprove(e.target.value)}
                  placeholder="e.g. Brush up on Redis cluster failovers"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Questions Asked by Interviewer (One per line)
                </label>
                <textarea
                  rows={2}
                  value={questionsAsked}
                  onChange={(e) => setQuestionsAsked(e.target.value)}
                  placeholder="e.g. Design an idempotent payment processing webhook"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Overall Impression & Takeaways
                </label>
                <textarea
                  rows={2}
                  value={overallImpression}
                  onChange={(e) => setOverallImpression(e.target.value)}
                  placeholder="Summary of vibe, conversation depth, and next steps..."
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedbackInterview(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {submittingFeedback ? 'Saving...' : 'Save Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Custom Practice Simulation */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Launch AI Practice Simulation</h3>
                <p className="text-xs text-on-surface-variant">
                  Powered by Progeni Atlas • Technical Interview Simulation
                </p>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs">
              <span className="font-semibold">Zero-Hallucination Mock:</span> This simulation runs in Progeni Atlas with real AI proctoring, live voice transcription, and live coding. It will not affect your real job application status.
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleLaunchSimulation();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Target Job Role
                </label>
                <input
                  type="text"
                  required
                  value={customSimRole}
                  onChange={(e) => setCustomSimRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer (Node.js & Go)"
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Target Job Description & Topics (Optional)
                </label>
                <textarea
                  rows={4}
                  value={customSimJd}
                  onChange={(e) => setCustomSimJd(e.target.value)}
                  placeholder="Paste relevant job description requirements, architectural topics, or focus areas..."
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant hover:bg-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launchingSimId === 'custom'}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
                >
                  {launchingSimId === 'custom' ? 'Initializing Progeni...' : '🚀 Launch Live Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
