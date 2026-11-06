'use client';

import { useEffect, useState } from 'react';
import {
  clearWorkspace,
  createExtensionPairingCode,
  deleteAccount,
  disableMfa,
  enableMfa,
  getMe,
  getMfaStatus,
  getSessions,
  logoutAllDevices,
  revokeSession,
  usesCloudAuthentication,
} from '../../../lib/api';

export default function PrivacySettingsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [mfaStatus, setMfaStatus] = useState<boolean>(false);

  useEffect(() => {
    void loadAuthData();
  }, []);

  async function loadAuthData() {
    try {
      const [meRes, sessRes, mfaRes] = await Promise.all([
        getMe().catch(() => null),
        getSessions().catch(() => []),
        getMfaStatus().catch(() => null),
      ]);
      if (meRes?.user) {
        setUserInfo(meRes.user);
        setMfaStatus(meRes.user.mfaEnabled ?? false);
      }
      if (sessRes) setSessions(sessRes);
      if (mfaRes) setMfaStatus(mfaRes.mfaEnabled);
    } catch {
      // Non-blocking in dev mode
    }
  }

  async function handleToggleMfa() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mfaStatus) {
        if (!window.confirm('Disable Multi-Factor Authentication on your account?')) {
          setBusy(false);
          return;
        }
        await disableMfa();
        setMfaStatus(false);
        setNotice('Multi-Factor Authentication disabled.');
      } else {
        await enableMfa();
        setMfaStatus(true);
        setNotice('Multi-Factor Authentication enabled on your account.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update MFA setting.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePairingCode() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await createExtensionPairingCode();
      setPairingCode(res.pairingCode);
      setNotice('Pairing code generated! Enter this code in your extension within 5 minutes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate extension pairing code.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoutAll() {
    if (!window.confirm('Sign out of all devices? You will need to sign in again on every device.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await logoutAllDevices();
      window.location.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke sessions.');
      setBusy(false);
    }
  }

  async function handleRevokeSingle(sessionId: string) {
    setBusy(true);
    setError('');
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setNotice('Session revoked successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke session.');
    } finally {
      setBusy(false);
    }
  }

  async function handleClearWorkspace() {
    if (!window.confirm('Delete your saved profile, resume evidence, jobs, match results, and application tracker? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await clearWorkspace();
      window.location.replace('/dashboard');
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear workspace data.');
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmation = window.prompt(
      'DANGER: This will permanently delete your account, authentication credentials, and all candidate data. Type DELETE to confirm:',
    );
    if (confirmation !== 'DELETE') return;

    setBusy(true);
    setError('');
    try {
      await deleteAccount();
      window.location.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account.');
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR DATA, YOUR CHOICE</p>
          <h1>Privacy & security settings</h1>
          <p>Manage your account security, extension pairing, active devices, and workspace data.</p>
        </div>
      </header>

      {notice && <p className="notice" style={{ maxWidth: 820, marginBottom: 16 }}>{notice}</p>}
      {error && <p className="form-error" role="alert" style={{ maxWidth: 820, marginBottom: 16 }}>{error}</p>}

      {/* Account Info & Extension Pairing Card */}
      <section className="card card-padding" style={{ maxWidth: 820, marginBottom: 24 }}>
        <h2 className="card-title">Chrome extension pairing</h2>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          Pair your browser extension securely with your account using a one-time code without entering your password in the extension.
        </p>
        {pairingCode ? (
          <div style={{ marginTop: 14, padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
            <p style={{ fontSize: '0.875rem', color: '#166534', fontWeight: 600 }}>Your 5-Minute Pairing Code:</p>
            <p style={{ fontSize: '1.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#15803d', letterSpacing: '2px', marginTop: 4 }}>
              {pairingCode}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#166534', marginTop: 4 }}>
              Open the Progeni Chrome Extension Side Panel, click &ldquo;Pair with Code&rdquo;, and paste this code.
            </p>
          </div>
        ) : (
          <button className="button button-primary" style={{ marginTop: 14 }} disabled={busy} onClick={() => void handleGeneratePairingCode()}>
            {busy ? 'Generating…' : 'Generate extension pairing code'}
          </button>
        )}
      </section>

      {/* Active Sessions & Device Management Card */}
      <section className="card card-padding" style={{ maxWidth: 820, marginBottom: 24 }}>
        <h2 className="card-title">Active sessions & devices</h2>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          Review browsers and devices where your account is currently signed in.
        </p>
        {sessions.length > 0 ? (
          <div style={{ marginTop: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '8px 0' }}>Device / Browser</th>
                  <th style={{ padding: '8px 0' }}>Last active</th>
                  <th style={{ padding: '8px 0' }}>Status</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0', fontWeight: 500 }}>{sess.browser || 'Web Browser'} ({sess.os || 'Desktop'})</td>
                    <td style={{ padding: '10px 0', color: '#6b7280' }}>{new Date(sess.lastActiveAt).toLocaleString()}</td>
                    <td style={{ padding: '10px 0' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', background: sess.revokedAt ? '#fef2f2' : '#f0fdf4', color: sess.revokedAt ? '#991b1b' : '#166534' }}>
                        {sess.revokedAt ? 'Revoked' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>
                      {!sess.revokedAt && (
                        <button className="button" style={{ fontSize: '0.75rem', padding: '4px 8px' }} disabled={busy} onClick={() => void handleRevokeSingle(sess.id)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ marginTop: 12, fontSize: '0.875rem', color: '#6b7280' }}>No active remote sessions recorded.</p>
        )}
        <button className="button button-secondary" style={{ marginTop: 16 }} disabled={busy} onClick={() => void handleLogoutAll()}>
          Log out of all devices
        </button>
      </section>

      {/* Multi-Factor Authentication (MFA) Card */}
      <section className="card card-padding" style={{ maxWidth: 820, marginBottom: 24 }}>
        <h2 className="card-title">Multi-factor authentication (MFA)</h2>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          Add an extra layer of protection to your account by requiring an authenticator code when signing in or performing sensitive actions.
        </p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Current status: </span>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 99,
              fontSize: '0.75rem',
              fontWeight: 600,
              background: mfaStatus ? '#f0fdf4' : '#f3f4f6',
              color: mfaStatus ? '#166534' : '#6b7280',
            }}>
              {mfaStatus ? 'Enabled (AAL2 Protected)' : 'Disabled'}
            </span>
          </div>
          <button
            className={`button ${mfaStatus ? 'button-secondary' : 'button-primary'}`}
            disabled={busy}
            onClick={() => void handleToggleMfa()}
          >
            {busy ? 'Updating…' : mfaStatus ? 'Disable MFA' : 'Enable MFA'}
          </button>
        </div>
      </section>

      {/* Workspace Data & Account Deletion Card */}
      <section className="card card-padding" style={{ maxWidth: 820 }}>
        <h2 className="card-title">Danger zone</h2>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          Clear your candidate workspace data or permanently delete your account.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="button" style={{ color: '#a23f4c', borderColor: '#f0d7db', background: '#fff8f8' }} disabled={busy} onClick={() => void handleClearWorkspace()}>
            Clear workspace data only
          </button>
          <button className="button" style={{ color: '#ffffff', borderColor: '#b91c1c', background: '#dc2626' }} disabled={busy} onClick={() => void handleDeleteAccount()}>
            Permanently delete account
          </button>
        </div>
      </section>
    </div>
  );
}
