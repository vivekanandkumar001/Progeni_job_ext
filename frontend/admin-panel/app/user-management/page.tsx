'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

interface UserRecord {
  id: string;
  email: string;
  role: 'candidate' | 'premium_candidate' | 'support' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'deleted';
  lastSignInAt: string;
  createdAt: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers(query = '') {
    setBusy(true);
    setError('');
    const token = localStorage.getItem('progeni.adminToken') || '';
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
    const token = localStorage.getItem('progeni.adminToken') || '';
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user role.');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)));
      setNotice(`User role updated to ${newRole}.`);
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
    const token = localStorage.getItem('progeni.adminToken') || '';
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/admin/users/${encodeURIComponent(userId)}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user status.');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: data.user.status } : u)));
      setNotice(`User status updated to ${nextStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>User & Role Management</h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
          Inspect candidate identities, manage role-based permissions, and enforce account governance.
        </p>
      </header>

      {notice && <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', marginBottom: '1rem', fontSize: '0.875rem' }}>{notice}</div>}
      {error && <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search by email or user UUID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
        />
        <button
          onClick={() => void loadUsers(search)}
          disabled={busy}
          style={{ padding: '0.625rem 1.25rem', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}
        >
          {busy ? 'Searching…' : 'Search Users'}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#374151', fontWeight: 600 }}>
            <tr>
              <th style={{ padding: '0.75rem 1rem' }}>User / Email</th>
              <th style={{ padding: '0.75rem 1rem' }}>Role</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>Last Active</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{u.email}</div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>{u.id}</div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => void handleRoleChange(u.id, e.target.value)}
                      style={{ padding: '0.375rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
                    >
                      <option value="candidate">Candidate</option>
                      <option value="premium_candidate">Premium Candidate</option>
                      <option value="support">Support</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: u.status === 'active' ? '#f0fdf4' : '#fef2f2',
                        color: u.status === 'active' ? '#166534' : '#991b1b',
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', color: '#6b7280' }}>
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => void handleStatusToggle(u.id, u.status)}
                      disabled={busy}
                      style={{
                        padding: '4px 10px',
                        border: '1px solid #d1d5db',
                        background: u.status === 'active' ? '#fff' : '#f0fdf4',
                        color: u.status === 'active' ? '#b91c1c' : '#15803d',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      {u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  {busy ? 'Loading user directory…' : 'No users found matching query.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
