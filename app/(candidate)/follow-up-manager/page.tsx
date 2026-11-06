'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listFollowUps,
  logFollowUpAction,
  type FollowUpItem,
} from '../../../lib/api';

export default function FollowUpManagerPage() {
  const [followUps, setFollowUps] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('pending');

  // Log Action Modal
  const [actionItem, setActionItem] = useState<FollowUpItem | null>(null);
  const [actionDescription, setActionDescription] = useState('Sent email status inquiry');
  const [actionNotes, setActionNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await listFollowUps({
        status: filter === 'completed' ? 'completed' : filter === 'pending' || filter === 'overdue' ? 'pending' : undefined,
        overdueOnly: filter === 'overdue',
      });
      setFollowUps(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load follow-up tasks.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filter]);

  function openActionModal(item: FollowUpItem) {
    setActionItem(item);
    setActionDescription('Sent follow-up email');
    setActionNotes('');
    setMarkCompleted(true);
    setNextFollowUpDate('');
  }

  async function handleActionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!actionItem) return;

    setSubmittingAction(true);
    try {
      await logFollowUpAction(actionItem.id, {
        action: actionDescription,
        notes: actionNotes || undefined,
        markCompleted,
        nextFollowUpDate: nextFollowUpDate || undefined,
      });
      setNotice(`Follow-up action logged for ${actionItem.company}.`);
      setActionItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to log follow-up action.');
    } finally {
      setSubmittingAction(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Follow-Up Manager</h1>
          <p className="text-sm text-zinc-400">
            Never let an opportunity go cold. Track recruiter touchpoints, inquiry dates, and overdue tasks.
          </p>
        </div>

        <Link
          href="/application-tracker"
          className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition self-start sm:self-auto"
        >
          ← Application Tracker
        </Link>
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
      <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        {[
          { key: 'pending', label: 'Pending Tasks' },
          { key: 'overdue', label: 'Overdue Only' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All Tasks' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              filter === tab.key
                ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading follow-up tasks...</div>
        ) : followUps.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-zinc-400 text-sm">No follow-up tasks found for this view.</p>
            <p className="text-xs text-zinc-500">
              Tasks can be scheduled from any application dossier in the Application Tracker.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {followUps.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/40 transition"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-100 text-base">{item.nextAction}</span>
                    <span className="text-zinc-400 text-xs">for</span>
                    <span className="text-zinc-200 font-medium text-xs">{item.company}</span>
                    <span className="text-zinc-500 text-xs">({item.jobTitle})</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : item.isOverdue
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {item.isOverdue ? '⚠️ OVERDUE' : item.status.toUpperCase()}
                    </span>

                    <span>Due: {item.followUpDate}</span>

                    {item.contactDetails?.name && (
                      <span>
                        Contact: {item.contactDetails.name}{' '}
                        {item.contactDetails.email && `(${item.contactDetails.email})`}
                      </span>
                    )}

                    <span>History: {item.history.length} event(s)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.status !== 'completed' && (
                    <button
                      onClick={() => openActionModal(item)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
                    >
                      Log Action / Complete
                    </button>
                  )}
                  <Link
                    href={`/application-details?id=${encodeURIComponent(item.applicationId)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
                  >
                    Dossier →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Log Action */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Log Follow-Up Action</h3>
                <p className="text-xs text-zinc-400">{actionItem.company} • {actionItem.jobTitle}</p>
              </div>
              <button
                onClick={() => setActionItem(null)}
                className="text-zinc-400 hover:text-zinc-200 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Action Performed *
                </label>
                <select
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                >
                  <option value="Sent email status inquiry">Sent email status inquiry</option>
                  <option value="Reached out on LinkedIn">Reached out on LinkedIn</option>
                  <option value="Followed up with hiring manager">Followed up with hiring manager</option>
                  <option value="Received recruiter reply">Received recruiter reply</option>
                  <option value="Submitted requested supplementary materials">Submitted supplementary materials</option>
                  <option value="Other follow-up action">Other follow-up action</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Details & Notes
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Recruiter response, questions asked, or next expectation..."
                  className="w-full px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markCompleted}
                    onChange={(e) => setMarkCompleted(e.target.checked)}
                    className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                  />
                  Mark this follow-up task as Completed
                </label>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Or Schedule Next Follow-Up (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionItem(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {submittingAction ? 'Logging...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
