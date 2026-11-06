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
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">Follow-Up Manager</h1>
          <p className="text-sm text-on-surface-variant">
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
      <div className="flex gap-2 p-1 bg-surface border border-outline-variant rounded-xl w-fit">
        {[
          { key: 'pending', label: 'Pending Tasks' },
          { key: 'overdue', label: 'Overdue Only' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All Tasks' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${ filter === tab.key ? 'bg-surface-subtle text-on-surface shadow-sm border border-outline' : 'text-on-surface-variant hover:text-on-surface' }`}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">Loading follow-up tasks...</div>
        ) : followUps.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-on-surface-variant text-sm">No follow-up tasks found for this view.</p>
            <p className="text-xs text-on-surface-variant">
              Tasks can be scheduled from any application dossier in the Application Tracker.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {followUps.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface transition"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-on-surface text-base">{item.nextAction}</span>
                    <span className="text-on-surface-variant text-xs">for</span>
                    <span className="text-on-surface font-medium text-xs">{item.company}</span>
                    <span className="text-on-surface-variant text-xs">({item.jobTitle})</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ item.status === 'completed' ? 'bg-success/10 text-success border border-success/20' : item.isOverdue ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-warning/10 text-warning border border-warning/20' }`}}
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
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30 transition"
                    >
                      Log Action / Complete
                    </button>
                  )}
                  <Link
                    href={`/application-details?id=${encodeURIComponent(item.applicationId)}`}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-subtle hover:bg-surface-variant text-on-surface border border-outline transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface backdrop-blur-sm">
          <div className="bg-surface border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-on-surface">Log Follow-Up Action</h3>
                <p className="text-xs text-on-surface-variant">{actionItem.company} • {actionItem.jobTitle}</p>
              </div>
              <button
                onClick={() => setActionItem(null)}
                className="text-on-surface-variant hover:text-on-surface text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Action Performed *
                </label>
                <select
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
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
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Details & Notes
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Recruiter response, questions asked, or next expectation..."
                  className="w-full px-3 py-2 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-outline-variant">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markCompleted}
                    onChange={(e) => setMarkCompleted(e.target.checked)}
                    className="rounded bg-surface-subtle border-outline text-success"
                  />
                  Mark this follow-up task as Completed
                </label>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1">
                    Or Schedule Next Follow-Up (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-surface-subtle border border-outline rounded-lg text-on-surface"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionItem(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-surface-subtle text-on-surface-variant"
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
