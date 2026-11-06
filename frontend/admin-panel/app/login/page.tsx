'use client';

import { useState, type FormEvent } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleAdminLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      // In local development or standalone admin login
      const response = await fetch(`${API_BASE}/api/v1/local/session`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok || !data.token) {
        throw new Error(data.error || 'Failed to authenticate with backend.');
      }

      // Check role verification against /api/v1/admin/health
      const checkRes = await fetch(`${API_BASE}/api/v1/admin/health`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      if (!checkRes.ok) {
        throw new Error('Forbidden: Insufficient privileges. Only admin and super_admin roles may access this console.');
      }

      localStorage.setItem('progeni.adminToken', data.token);
      window.location.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', padding: '1rem' }}>
      <section style={{ maxWidth: 440, width: '100%', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', width: 36, height: 36, background: '#111827', color: '#fff', borderRadius: 8, lineHeight: '36px', fontWeight: 700, fontSize: '1.25rem' }}>A</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.75rem', color: '#111827' }}>Admin Console Login</h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>Strictly restricted to authorized administrative personnel.</p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => void handleAdminLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
              Administrator Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@progeni.live"
              style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              style={{ width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{ width: '100%', padding: '0.75rem', background: '#111827', color: '#ffffff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Authenticating…' : 'Sign In as Administrator'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
          All access attempts are monitored and recorded in immutable security audit logs.
        </p>
      </section>
    </main>
  );
}
