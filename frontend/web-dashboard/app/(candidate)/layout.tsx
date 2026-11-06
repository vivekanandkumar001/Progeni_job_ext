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

import AuthScreen from '../../components/AuthScreen';

const navigation = [
  { href: '/dashboard', label: 'Overview', symbol: '⌂' },
  { href: '/onboarding', label: 'Onboarding wizard', symbol: '✦' },
  { href: '/candidate-profile', label: 'Career profile', symbol: '◉' },
  { href: '/job-recommendations', label: 'Jobs & discovery', symbol: '🔍' },
  { href: '/job-match-intelligence', label: 'Match intelligence', symbol: '⚡' },
  { href: '/skill-gap-analyzer', label: 'Skill gap analyzer', symbol: '📊' },
  { href: '/resume-manager', label: 'Resume upload', symbol: '▧' },
  { href: '/resume-studio', label: 'Resume studio', symbol: '✎' },
  { href: '/resume-analyzer', label: 'ATS diagnostics', symbol: '◎' },
  { href: '/targeted-resume', label: 'Targeted generator', symbol: '🎯' },
  { href: '/truth-engine', label: 'Truth engine', symbol: '🛡' },
  { href: '/application-assistant', label: 'Application assistant', symbol: '🤖' },
  { href: '/application-tracker', label: 'Application tracker', symbol: '▤' },
  { href: '/interview-center', label: 'Interview center', symbol: '🗓' },
  { href: '/follow-up-manager', label: 'Follow-up manager', symbol: '⏰' },
  { href: '/performance-analytics', label: 'Analytics & rates', symbol: '📈' },
  { href: '/notifications', label: 'Notifications', symbol: '🔔' },
  { href: '/billing', label: 'Plans & billing', symbol: '💳' },
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
      <main className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-6 animate-pulse">
            <span className="text-white font-black text-2xl">P</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-indigo-400 font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            Connecting to Workspace
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Restoring Your Session</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {usesCloudAuthentication
              ? 'Authenticating with cloud workspace and syncing candidate data…'
              : 'Connecting to your local Progeni backend…'}
          </p>
        </div>
      </main>
    );
  }

  if (auth === 'required' || auth === 'unavailable') {
    return (
      <AuthScreen
        initialMode="sign-in"
        nextPath={pathname}
        onSuccess={() => {
          setAuth('authenticated');
          void checkConsent();
        }}
      />
    );
  }

  if (consent === 'loading') {
    return (
      <main className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-6 animate-pulse">
            <span className="text-white font-black text-2xl">P</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Loading Career Intelligence</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Retrieving candidate preferences and verification state…
          </p>
        </div>
      </main>
    );
  }

  if (consent !== 'accepted' && pathname !== '/onboarding') {
    return (
      <main className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-6 text-slate-100 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <section className="relative z-10 w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-black text-xl">P</span>
            </div>
            <div>
              <span className="text-base font-bold text-white block">
                PROGENI <span className="text-indigo-400">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                Privacy & Security Guardrails
              </span>
            </div>
          </div>
          {consent === 'unavailable' ? (
            <div>
              <h1 className="text-2xl font-bold text-white mb-3">
                {usesCloudAuthentication ? 'Workspace Unavailable' : 'Local Backend Unavailable'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                {message || 'Start the backend from the backend folder, then retry.'}
              </p>
              <button
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
                disabled={busy}
                onClick={() => void checkConsent()}
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-semibold mb-4">
                <span>🛡️</span> Zero Data Misuse Guarantee
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Before you build your workspace</h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
                Your career profile, job targets, match scores, and application tracker
                {usesCloudAuthentication
                  ? ' are securely persisted in your Progeni cloud workspace on MongoDB Atlas.'
                  : ' stay securely on this device.'}
                {' '}The extension reads a job page only when you explicitly click Detect.
              </p>
              <div className="space-y-3 mb-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Zero Hallucinations:</strong> Resumes and answers are grounded strictly in your confirmed master records.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Human In The Loop:</strong> Applications are never auto-submitted without your explicit digital approval.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="text-emerald-400 font-bold mt-0.5">✓</span>
                  <span><strong>Data Sovereignty:</strong> You can export or permanently wipe your workspace records anytime.</span>
                </div>
              </div>
              <button
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50"
                disabled={busy}
                onClick={() => void giveConsent()}
              >
                {busy ? 'Saving choice…' : 'I Understand & Agree — Continue to Dashboard'}
              </button>
              {message && <p className="mt-3 text-xs text-rose-400" role="alert">{message}</p>}
            </div>
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
