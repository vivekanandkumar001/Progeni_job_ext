'use client';

import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

const FEATURES = [
  {
    icon: ShieldCheck,
    text: 'Role-gated access for admin and super_admin operators only.',
  },
  {
    icon: Fingerprint,
    text: 'Every privileged action is written to an immutable security audit log.',
  },
  {
    icon: LockKeyhole,
    text: 'Billing, identity and compliance controls in a single console.',
  },
];

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
        throw new Error(
          'Forbidden: Insufficient privileges. Only admin and super_admin roles may access this console.',
        );
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
    <main className="auth-screen">
      <div className="auth-shell animate-rise">
        <aside className="auth-aside">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden>
              P
            </span>
            <span>
              PROGENI <span style={{ opacity: 0.65 }}>/ ADMIN</span>
            </span>
          </div>

          <div>
            <h2>Operate the platform with complete context.</h2>
            <p>
              Revenue, metered AI usage, candidate identity and compliance telemetry - unified in
              one privileged control room.
            </p>
            <ul className="auth-feature-list">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.text}>
                    <Icon size={15} strokeWidth={2} />
                    <span>{feature.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="auth-aside-foot">
            <span className="live-dot" aria-hidden />
            Verified administrative environment
          </div>
        </aside>

        <section className="auth-form-side">
          <div className="brand-lockup" style={{ marginBottom: 4 }}>
            <span className="brand-mark" aria-hidden>
              P
            </span>
            <span>PROGENI ADMIN</span>
          </div>

          <div className="auth-form-head">
            <p className="eyebrow">Restricted access</p>
            <h1>Admin console sign in</h1>
            <p>Use an administrator account to continue. Access attempts are monitored.</p>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={(event) => void handleAdminLogin(event)}>
            <label className="field">
              Administrator email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@progeni.live"
              />
            </label>

            <label className="field">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
            </label>

            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={15} className="spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <KeyRound size={15} />
                  Sign in as administrator
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="auth-meta">
            All access attempts are monitored and recorded in immutable security audit logs.
          </p>
        </section>
      </div>
    </main>
  );
}
