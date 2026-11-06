'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listInAppNotifications,
  markNotificationAsRead,
  markAllInAppNotificationsAsRead,
  type NotificationItem,
} from '../../../lib/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await listInAppNotifications(unreadOnly);
      setNotifications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [unreadOnly]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationAsRead(id);
      setNotifications((curr) =>
        curr.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to mark as read.');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllInAppNotificationsAsRead();
      setNotifications((curr) => curr.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      setError(err.message || 'Failed to mark all as read.');
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'upcoming_interview':
        return '🗓';
      case 'follow_up_reminder':
        return '⏰';
      case 'status_change':
        return '⚡';
      case 'offer_deadline':
        return '🎉';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Notification Center
          </h1>
          <p className="text-sm text-zinc-400">
            Timely interview alerts, overdue reminders, and lifecycle status updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700 transition"
          >
            ✓ Mark All Read
          </button>
          <Link
            href="/application-tracker"
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition"
          >
            ← Application Tracker
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            !unreadOnly
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
            unreadOnly
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* Notification List */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-400">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">No notifications to display.</div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`p-4 flex items-start justify-between gap-4 transition ${
                  item.read ? 'bg-transparent' : 'bg-indigo-950/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl pt-0.5">{getTypeIcon(item.type)}</span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-200">{item.title}</span>
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{item.message}</p>
                    <span className="text-[10px] text-zinc-500 block">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.applicationId && (
                    <Link
                      href={`/application-details?id=${encodeURIComponent(item.applicationId)}`}
                      className="px-2.5 py-1 text-xs text-indigo-400 hover:underline"
                    >
                      Dossier →
                    </Link>
                  )}
                  {!item.read && (
                    <button
                      onClick={() => handleMarkRead(item.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
