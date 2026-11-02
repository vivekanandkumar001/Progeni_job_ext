import React, { useEffect, useState } from 'react';
import { ensureSupabaseHostPermission, makeRequestId, sendMessage } from '../shared/messages';

interface ResponseData {
  ok?: boolean;
  accepted?: boolean;
  authenticated?: boolean;
  local?: boolean;
  confirmationRequired?: boolean;
  email?: string;
  supported?: boolean;
  status?: string;
  job?: { title?: string; company?: string };
  error?: string;
}

export default function Popup() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [job, setJob] = useState<ResponseData['job'] | null>(null);

  useEffect(() => {
    void refreshAuth();
  }, []);

  async function refreshAuth() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_AUTH_STATE' });
      if (!result.ok) throw new Error(result.error || 'Could not check your account sign-in.');
      setAuthenticated(result.authenticated === true);
      setLocalMode(result.local === true);
      setStatus('');
      if (result.authenticated) await refreshConsent();
    } catch (error) {
      setAuthenticated(false);
      setStatus(error instanceof Error ? error.message : 'Could not connect to your account.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await ensureSupabaseHostPermission();
      const result = await sendMessage<ResponseData>({
        type: authMode === 'sign-up' ? 'SIGN_UP' : 'SIGN_IN',
        email: email.trim(),
        password,
      });
      if (!result.ok) throw new Error(result.error || 'Could not authenticate your account.');
      if (result.confirmationRequired) {
        setStatus('Check your email to confirm your account, then sign in.');
        return;
      }
      setAuthenticated(result.authenticated === true);
      if (result.authenticated) await refreshConsent();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not check the privacy notice.');
      setConsent(result.accepted === true);
      setStatus('');
    } catch (error) {
      setConsent(null);
      setStatus(error instanceof Error ? error.message : 'The Progeni workspace is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SAVE_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not save your consent.');
      setConsent(true);
      setStatus('Privacy notice accepted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your consent.');
    } finally {
      setBusy(false);
    }
  }

  async function detectJob() {
    setBusy(true);
    setStatus('Checking the active tab…');
    setJob(null);
    try {
      const activeTab = await sendMessage<ResponseData & { url?: string; tabId?: number }>({
        type: 'GET_ACTIVE_TAB',
      });
      if (!activeTab.ok) throw new Error(activeTab.error || 'Could not read the active tab.');
      if (!activeTab.url || activeTab.tabId === undefined) {
        throw new Error('Open a job page before detecting a job.');
      }
      const result = await sendMessage<ResponseData>({
        type: 'DETECT_REQUEST',
        url: activeTab.url,
        tabId: activeTab.tabId,
        requestId: makeRequestId(),
      });
      if (!result.ok) throw new Error(result.error || 'Job detection failed.');
      if (result.status !== 'supported') {
        setStatus('This site is not supported. You can enter job details in the dashboard.');
        return;
      }
      setJob(result.job || null);
      setStatus('Job details detected. Review them in the side panel before saving.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Job detection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openDashboard() {
    await chrome.tabs.create({
      url: import.meta.env.DEV || import.meta.env.PROGENI_LOCAL
        ? 'http://localhost:3000/dashboard'
        : 'https://job.progeni.live/dashboard',
    });
    window.close();
  }

  async function leaveAccount() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SIGN_OUT' });
      if (!result.ok) throw new Error(result.error || 'Could not sign out.');
      setAuthenticated(false);
      setConsent(null);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  if (authenticated === null) {
    return <main className="popup"><p className="status">Connecting to your Progeni account…</p></main>;
  }

  if (!authenticated) {
    return (
      <main className="popup">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div><strong>Progeni AutoApply</strong><span>Sign in to your career workspace</span></div>
        </header>
        <section className="card">
          <h1>{authMode === 'sign-up' ? 'Create your account' : 'Welcome back'}</h1>
          <p>Use the same account as your Progeni web dashboard.</p>
          <form className="form-grid" onSubmit={(event) => void submitAuth(event)}>
            <label className="full-width">Email
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="full-width">Password
              <input type="password" autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button className="primary full-width" disabled={busy}>
              {busy ? 'Please wait…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <button className="text-button" disabled={busy} onClick={() => {
            setAuthMode((mode) => mode === 'sign-in' ? 'sign-up' : 'sign-in');
            setStatus('');
          }}>
            {authMode === 'sign-up' ? 'Already have an account? Sign in' : 'Create a new account'}
          </button>
        </section>
        {status && <p className="status" role="status">{status}</p>}
      </main>
    );
  }

  return (
    <main className="popup">
      <header className="brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>Progeni AutoApply</strong>
          <span>{localMode ? 'Career workspace · local' : 'Career workspace · account'}</span>
        </div>
      </header>

      {consent !== true ? (
        <section className="card">
          <h1>Before you begin</h1>
          <p>
            With your permission, Progeni reads job details only when you choose Detect.
            Your profile, detected jobs, and tracker are stored {localMode
              ? 'on this device by the local backend.'
              : 'in the Progeni workspace linked to your account.'}
            {' '}They are not sent to an AI provider or job site.
          </p>
          <p className="muted">
            Resume files are processed to suggest details; the original file and full text
            are not saved. You can clear your workspace data. Submission is always manual.
          </p>
          <button className="primary" disabled={busy || consent === null} onClick={acceptConsent}>
            {busy ? 'Connecting…' : 'I agree and continue'}
          </button>
          {consent === null && (
            <button className="secondary" disabled={busy} onClick={() => void refreshConsent()}>
              Retry connection
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="card">
            <div className="section-heading">
              <div>
                <h1>Current job</h1>
                <p>Detect job details only when you ask.</p>
              </div>
              <span className="local-badge">{localMode ? 'LOCAL' : 'ACCOUNT'}</span>
            </div>
            {job && (
              <div className="job-preview">
                <strong>{job.title || 'Untitled job'}</strong>
                <span>{job.company || 'Company not detected'}</span>
              </div>
            )}
            <button className="primary" disabled={busy} onClick={() => void detectJob()}>
              {busy ? 'Working…' : 'Detect this job'}
            </button>
            <button className="secondary" onClick={() => void sendMessage({ type: 'OPEN_SIDE_PANEL' })}>
              Open career side panel
            </button>
            <button className="text-button" onClick={() => void openDashboard()}>
              Open dashboard
            </button>
            {!localMode && (
              <button className="text-button" disabled={busy} onClick={() => void leaveAccount()}>
                Sign out
              </button>
            )}
          </section>
          <p className="policy-note">
            Manual review and submission only. Progeni never clicks Apply or bypasses
            platform controls.
          </p>
        </>
      )}
      {status && <p className="status" role="status">{status}</p>}
    </main>
  );
}
