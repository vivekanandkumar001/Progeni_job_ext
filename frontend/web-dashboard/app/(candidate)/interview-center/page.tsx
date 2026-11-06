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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Interview Pipeline</h1>
          <p className="text-sm text-zinc-400">
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
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition"
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STAGES.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              activeStage === s.key
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-400">Loading interview rounds...</div>
      ) : interviews.length === 0 ? (
        <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3">
          <p className="text-zinc-400 text-sm">No interviews found for this selection.</p>
          <p className="text-xs text-zinc-500">
            Schedule an interview from an application dossier or start a technical practice simulation above.
          </p>
        </div>
      ) : viewMode === 'agenda' ? (
        /* Agenda View */
        <div className="space-y-6">
          {/* Upcoming Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400">
              Upcoming Rounds ({upcomingInterviews.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingInterviews.map((item) => (
                <div
                  key={item.id}
                  className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3 relative hover:border-zinc-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-purple-400 uppercase">
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                      <h3 className="text-base font-bold text-zinc-100">{item.company}</h3>
                      <p className="text-xs text-zinc-400">{item.jobTitle}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      SCHEDULED
                    </span>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Date & Time:</span>
                      <span className="font-medium text-zinc-200">
                        {new Date(item.scheduledAt).toLocaleString()} ({item.timezone})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">Duration:</span>
                      <span>{item.durationMinutes} minutes ({item.interviewMode})</span>
                    </div>
                    {item.interviewerDetails?.name && (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Interviewer:</span>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-medium transition disabled:opacity-50"
                    >
                      {launchingSimId === item.id ? '⚡ Launching...' : '🤖 Practice AI Simulation (Progeni)'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <Link
                      href={`/application-details?id=${encodeURIComponent(item.applicationId)}`}
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      View Dossier →
                    </Link>
                    <button
                      onClick={() => openFeedbackModal(item)}
                      className="px-3 py-1 text-xs font-medium rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Completed Rounds ({pastInterviews.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastInterviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium text-zinc-400 uppercase">
                          {item.stage.replace(/_/g, ' ')}
                        </span>
                        <h3 className="text-base font-semibold text-zinc-200">{item.company}</h3>
                        <p className="text-xs text-zinc-400">{item.jobTitle}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        COMPLETED
                      </span>
                    </div>

                    {item.feedback?.rating && (
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        <span>Rating: {'★'.repeat(item.feedback.rating)}{'☆'.repeat(5 - item.feedback.rating)}</span>
                        <span className="text-zinc-500">({item.feedback.rating}/5)</span>
                      </div>
                    )}

                    {item.feedback?.overallImpression && (
                      <p className="text-xs text-zinc-300 italic bg-zinc-800/40 p-2.5 rounded border border-zinc-700/40">
                        &ldquo;{item.feedback.overallImpression}&rdquo;
                      </p>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => openFeedbackModal(item)}
                        className="text-xs text-indigo-400 hover:underline"
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
              <div key={col.key} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-semibold text-zinc-300">{col.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    {colItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-xs space-y-1.5 shadow-sm"
                    >
                      <div className="font-semibold text-zinc-100">{item.company}</div>
                      <div className="text-[11px] text-zinc-400 truncate">{item.jobTitle}</div>
                      <div className="text-[10px] text-purple-400">
                        {new Date(item.scheduledAt).toLocaleDateString()}
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={() => handleLaunchSimulation(item)}
                          disabled={launchingSimId === item.id}
                          className="text-[10px] text-purple-400 hover:underline"
                        >
                          {launchingSimId === item.id ? 'Launching...' : '🤖 Simulation'}
                        </button>
                        <button
                          onClick={() => openFeedbackModal(item)}
                          className="text-[10px] text-indigo-400 hover:underline"
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
      <div className="space-y-4 pt-6 border-t border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400">
                Progeni Atlas AI Practice Simulations ({simulations.length})
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                INTEGRATED PLATFORM
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Technical mock interview simulations with live code execution, real-time transcription, and objective grading.
              <span className="text-amber-400 font-medium ml-1">
                * Evaluated by Progeni Atlas AI simulation engine (Mock practice only).
              </span>
            </p>
          </div>

          <button
            onClick={() => setShowSimModal(true)}
            className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition"
          >
            + New Practice Session
          </button>
        </div>

        {simulations.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
            <p className="text-xs text-zinc-400">No practice simulations launched yet.</p>
            <p className="text-[11px] text-zinc-500">
              Launch a simulation for an upcoming interview round or practice on demand to sharpen your technical readiness.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4 hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">{sim.companyName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400 uppercase">
                        AI Simulation
                      </span>
                    </div>
                    <p className="text-xs text-purple-300 font-medium">{sim.jobRole}</p>
                    <p className="text-[11px] text-zinc-500">
                      Launched: {new Date(sim.launchedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right">
                    {sim.overallScore !== undefined ? (
                      <div className="text-lg font-bold text-emerald-400">
                        {sim.overallScore}
                        <span className="text-xs text-zinc-500">/100</span>
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        IN PROGRESS
                      </span>
                    )}
                    {sim.hiringRecommendation && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        {sim.hiringRecommendation.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pillars */}
                {sim.competencyPillars && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-700/40">
                    <div>
                      <div className="text-zinc-500 flex justify-between">
                        <span>Algorithms:</span>
                        <span className="text-zinc-300 font-mono font-medium">
                          {sim.competencyPillars.algorithmicProblemSolving}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full"
                          style={{ width: `${sim.competencyPillars.algorithmicProblemSolving}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-zinc-500 flex justify-between">
                        <span>Architecture:</span>
                        <span className="text-zinc-300 font-mono font-medium">
                          {sim.competencyPillars.systemArchitecture}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full"
                          style={{ width: `${sim.competencyPillars.systemArchitecture}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-zinc-500 flex justify-between">
                        <span>Code Quality:</span>
                        <span className="text-zinc-300 font-mono font-medium">
                          {sim.competencyPillars.codeQualityAndSyntax}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full"
                          style={{ width: `${sim.competencyPillars.codeQualityAndSyntax}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-zinc-500 flex justify-between">
                        <span>Communication:</span>
                        <span className="text-zinc-300 font-mono font-medium">
                          {sim.competencyPillars.communicationAndClarity}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 h-1 rounded mt-1 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full"
                          style={{ width: `${sim.competencyPillars.communicationAndClarity}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {sim.executiveSummary && (
                  <p className="text-xs text-zinc-300 line-clamp-2">
                    {sim.executiveSummary}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
                  <button
                    onClick={() => handleSyncSimulation(sim.sessionId)}
                    disabled={syncingSimId === sim.sessionId}
                    className="text-zinc-400 hover:text-zinc-200 transition disabled:opacity-50"
                  >
                    {syncingSimId === sim.sessionId ? 'Syncing...' : '🔄 Sync Results'}
                  </button>

                  <div className="flex items-center gap-2">
                    {sim.launchUrl && (
                      <a
                        href={sim.launchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition text-[11px]"
                      >
                        Live Room →
                      </a>
                    )}
                    <a
                      href={`http://localhost:3000/candidate/interview/${encodeURIComponent(sim.sessionId)}/report`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition text-[11px] font-medium"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Post-Interview Evaluation</h3>
                <p className="text-xs text-zinc-400">
                  {feedbackInterview.company} • {feedbackInterview.stage.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                onClick={() => setFeedbackInterview(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Overall Signal Rating (1 - 5)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-xl ${rating >= star ? 'text-amber-400' : 'text-zinc-600'}`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="text-xs text-zinc-400 ml-2">({rating}/5 stars)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Key Strengths Observed (One per line)
                </label>
                <textarea
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="e.g. Explained distributed consensus clearly&#10;Good culture alignment"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Areas to Polish / Review (One per line)
                </label>
                <textarea
                  rows={2}
                  value={areasToImprove}
                  onChange={(e) => setAreasToImprove(e.target.value)}
                  placeholder="e.g. Brush up on Redis cluster failovers"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Questions Asked by Interviewer (One per line)
                </label>
                <textarea
                  rows={2}
                  value={questionsAsked}
                  onChange={(e) => setQuestionsAsked(e.target.value)}
                  placeholder="e.g. Design an idempotent payment processing webhook"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Overall Impression & Takeaways
                </label>
                <textarea
                  rows={2}
                  value={overallImpression}
                  onChange={(e) => setOverallImpression(e.target.value)}
                  placeholder="Summary of vibe, conversation depth, and next steps..."
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFeedbackInterview(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Launch AI Practice Simulation</h3>
                <p className="text-xs text-zinc-400">
                  Powered by Progeni Atlas • Technical Interview Simulation
                </p>
              </div>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs">
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
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Job Role
                </label>
                <input
                  type="text"
                  required
                  value={customSimRole}
                  onChange={(e) => setCustomSimRole(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer (Node.js & Go)"
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Target Job Description & Topics (Optional)
                </label>
                <textarea
                  rows={4}
                  value={customSimJd}
                  onChange={(e) => setCustomSimJd(e.target.value)}
                  placeholder="Paste relevant job description requirements, architectural topics, or focus areas..."
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
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
