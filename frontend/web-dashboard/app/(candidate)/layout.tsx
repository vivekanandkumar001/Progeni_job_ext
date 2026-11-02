'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  acceptConsent,
  getConsent,
  getSupabaseClient,
  signIn,
  signOut,
  signUp,
  usesCloudAuthentication,
} from '../../lib/api';

const navigation = [
  { href: '/dashboard', label: 'Overview', symbol: '⌂' },
  { href: '/candidate-profile', label: 'Career profile', symbol: '◉' },
  { href: '/resume-manager', label: 'Resume intelligence', symbol: '▧' },
  { href: '/application-assistant', label: 'Prepare & review', symbol: '✓' },
  { href: '/application-tracker', label: 'Application tracker', symbol: '▤' },
  { href: '/settings-privacy', label: 'Privacy & data', symbol: '◇' },
];

type ConsentState = 'loading' | 'required' | 'accepted' | 'unavailable';
type AuthState = 'loading' | 'required' | 'authenticated' | 'local' | 'unavailable';

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('loading');
  const [auth, setAuth] = useState<AuthState>(usesCloudAuthentication ? 'loading' : 'local');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const checkConsent = useCallback(async () => {
    setBusy(true);
    try {
      setConsent((await getConsent()) ? 'accepted' : 'required');
      setMessage('');
    } catch (error) {
      setConsent('unavailable');
      setMessage(error instanceof Error ? error.message : 'Local backend is unavailable.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!usesCloudAuthentication) return;
    let client: ReturnType<typeof getSupabaseClient>;
    try {
      client = getSupabaseClient();
    } catch (error) {
      setAuth('unavailable');
      setMessage(error instanceof Error ? error.message : 'Supabase authentication is not configured.');
      return;
    }
    if (!client) {
      setAuth('unavailable');
      setMessage('Supabase authentication is not configured for this deployment.');
      return;
    }

    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setAuth(session ? 'authenticated' : 'required');
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuth('unavailable');
        setMessage(`Could not restore your sign-in: ${error.message}`);
      } else {
        setAuth(data.session ? 'authenticated' : 'required');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (auth === 'local' || auth === 'authenticated') void checkConsent();
  }, [auth, checkConsent]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (authMode === 'sign-up') {
        const sessionCreated = await signUp(email.trim(), password);
        if (!sessionCreated) {
          setMessage('Check your email to confirm your account, then sign in.');
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function leaveAccount() {
    setBusy(true);
    setMessage('');
    try {
      await signOut();
      setConsent('loading');
      setAuth('required');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }

  async function giveConsent() {
    setBusy(true);
    try {
      await acceptConsent();
      setConsent('accepted');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your consent.');
    } finally {
      setBusy(false);
    }
  }

  if (auth === 'loading') {
    return (
      <main className="consent-screen">
        <section className="consent-card">
          <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
          <h1>Connecting to your {usesCloudAuthentication ? 'secure workspace' : 'local workspace'}</h1>
          <p>{usesCloudAuthentication ? 'Restoring your account and workspace.' : 'Your profile and job data stay on this device.'}</p>
        </section>
      </main>
    );
  }

  if (auth === 'required' || auth === 'unavailable') {
    return (
      <main className="consent-screen">
        <section className="consent-card">
          <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
          <p className="eyebrow">YOUR ACCOUNT, YOUR WORKSPACE</p>
          <h1>{auth === 'unavailable' ? 'Account service unavailable' : authMode === 'sign-up' ? 'Create your account' : 'Sign in to Progeni'}</h1>
          <p>
            Your workspace is stored under your account. Job-page detection is started
            only when you choose Detect; applications are never submitted automatically.
          </p>
          {auth === 'required' && (
            <form className="form-grid" onSubmit={(event) => void submitAuth(event)}>
              <label className="field field-full">
                Email
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="field field-full">
                Password
                <input
                  type="password"
                  autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className="button button-primary field-full" disabled={busy}>
                {busy ? 'Please wait…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          )}
          {auth === 'required' && (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                setAuthMode((mode) => mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setMessage('');
              }}
            >
              {authMode === 'sign-up' ? 'Already have an account? Sign in' : 'New to Progeni? Create an account'}
            </button>
          )}
          {message && <p className="form-error" role="alert">{message}</p>}
          <p><Link href="/privacy">Privacy policy</Link></p>
        </section>
      </main>
    );
  }

  if (consent === 'loading') {
    return (
      <main className="consent-screen">
        <section className="consent-card">
          <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
          <h1>Connecting to your workspace</h1>
          <p>Loading your saved privacy choice and candidate data.</p>
        </section>
      </main>
    );
  }

  if (consent !== 'accepted') {
    return (
      <main className="consent-screen">
        <section className="consent-card">
          <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
          {consent === 'unavailable' ? (
            <>
              <h1>{usesCloudAuthentication ? 'Workspace unavailable' : 'Local backend unavailable'}</h1>
              <p>{message || 'Start the backend from the backend folder, then retry.'}</p>
              <button className="button button-primary" disabled={busy} onClick={() => void checkConsent()}>
                Retry connection
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">YOUR DATA, YOUR CONTROL</p>
              <h1>Before you build your career workspace</h1>
              <p>
                Your career profile, job details, match results, and application tracker
                {usesCloudAuthentication
                  ? ' are stored in the Progeni workspace linked to your account on our MongoDB database.'
                  : ' are saved by the local Progeni backend on this device.'}
                {' '}The extension reads a job page only when you choose Detect. Your
                information is not sent to AI providers or job sites.
              </p>
              <p>
                If you choose Resume intelligence, the backend reads your selected
                PDF, DOCX, or text file to suggest profile details and skill evidence.
                The original file and full extracted text are not saved. Only details you
                review and confirm are added to your workspace.
              </p>
              <p>
                Review every application yourself. Progeni does not submit applications,
                bypass platform controls, or claim that a job was submitted automatically.
              </p>
              <p>
                You can remove your workspace data from Privacy &amp; data. Read the
                <Link href="/privacy"> privacy policy</Link> for data handling details.
              </p>
              <button className="button button-primary" disabled={busy} onClick={() => void giveConsent()}>
                {busy ? 'Saving…' : 'I agree and continue'}
              </button>
              {message && <p className="form-error" role="alert">{message}</p>}
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard">
          <span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span>
        </Link>
        <p className="sidebar-caption">YOUR CAREER WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? ' nav-link-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="online-dot" />
          <div>
            <strong>{usesCloudAuthentication ? 'Account workspace' : 'Local-first mode'}</strong>
            <span>{usesCloudAuthentication ? 'Synced with your account' : 'Your workspace stays on this device'}</span>
          </div>
        </div>
        {usesCloudAuthentication && (
          <button className="button button-secondary" disabled={busy} onClick={() => void leaveAccount()}>
            Sign out
          </button>
        )}
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>Candidate workspace</span>
          <span className="local-pill"><span className="online-dot" /> {usesCloudAuthentication ? 'ACCOUNT DATA' : 'LOCAL DATA'}</span>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
