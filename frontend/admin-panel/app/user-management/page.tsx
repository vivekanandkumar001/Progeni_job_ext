'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
const TOKEN_KEY = 'progeni.adminToken';

interface UserRecord {
  id: string;
  email: string;
  role: 'candidate' | 'premium_candidate' | 'support' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'deleted';
  lastSignInAt: string;
  createdAt: string;
}

const ROLES: Array<{ value: UserRecord['role']; label: string }> = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'premium_candidate', label: 'Premium candidate' },
  { value: 'support', label: 'Support' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
];

function initials(email: string) {
  const name = email.split('@')[0] || '?';
  return name.slice(0, 2);
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers(query = '') {
    setBusy(true);
    setError('');
    const token = localStorage.getItem(TOKEN_KEY) || '';
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/admin/users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch user directory.');
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading users.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setBusy(true);
    setError('');
    setNotice('');
    const token = localStorage.getItem(TOKEN_KEY) || '';
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/auth/admin/users/${encodeURIComponent(userId)}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role.');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)));
      setNotice(`User role updated to ${newRole.replace(/_/g, ' ')}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusToggle(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    setBusy(true);
    setError('');
    setNotice('');
    const token = localStorage.getItem(TOKEN_KEY) || '';
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/auth/admin/users/${encodeURIComponent(userId)}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: data.user.status } : u)),
      );
      setNotice(`User status updated to ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Identity &amp; access</p>
          <h1>User &amp; role management</h1>
          <p>
            Inspect candidate identities, manage role-based permissions and enforce account
            governance across the platform.
          </p>
        </div>
        <div className="page-heading-actions">
          <span className="chip chip-primary">
            <ShieldCheck size={12} />
            RBAC enforced
          </span>
          <button
            type="button"
            className="button button-secondary button-sm"
            onClick={() => void loadUsers(search)}
            disabled={busy}
          >
            <RefreshCw size={14} className={busy ? 'spin' : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div className="notice notice-success" style={{ marginBottom: 14 }} role="status">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} />
            {notice}
          </span>
          <button type="button" className="button button-ghost button-sm" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="notice notice-danger" style={{ marginBottom: 14 }} role="alert">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={15} />
            {error}
          </span>
          <button type="button" className="button button-ghost button-sm" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}

      <section className="card card-padding" style={{ marginBottom: 16 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void loadUsers(search);
          }}
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
        >
          <div className="input-with-icon" style={{ flex: '1 1 260px' }}>
            <Search size={15} />
            <input
              className="input"
              type="text"
              placeholder="Search by email or user UUID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="submit" className="button button-primary" disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Search size={15} />}
            {busy ? 'Searching...' : 'Search users'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-header card-padding" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="card-title">User directory</h2>
            <p className="card-description">
              {users.length > 0
                ? `${users.length} account${users.length === 1 ? '' : 's'} in this view`
                : 'Search the directory to load accounts'}
            </p>
          </div>
          <span className="chip">
            <Users size={12} />
            {users.length} shown
          </span>
        </div>

        <div className="table-wrap" style={{ border: 0, borderTop: '1px solid rgb(var(--outline-variant))', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User / email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar" aria-hidden>
                          {initials(u.email)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong>{u.email}</strong>
                          <span className="sub mono">{u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="status-select"
                        value={u.role}
                        disabled={busy}
                        onChange={(event) => void handleRoleChange(u.id, event.target.value)}
                        aria-label={`Role for ${u.email}`}
                      >
                        {ROLES.map((role) => (
                          <option value={role.value} key={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`chip ${
                          u.status === 'active'
                            ? 'chip-success'
                            : u.status === 'suspended'
                              ? 'chip-danger'
                              : ''
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td>
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className={`button button-sm ${
                          u.status === 'active' ? 'button-danger' : 'button-secondary'
                        }`}
                        onClick={() => void handleStatusToggle(u.id, u.status)}
                        disabled={busy}
                      >
                        {u.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      {busy ? <Loader2 className="spin" /> : <Users />}
                      {busy ? 'Loading user directory...' : 'No users found matching this query.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
