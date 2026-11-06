'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  acceptConsent,
  getConsent,
  getSupabaseClient,
  signOut,
  usesCloudAuthentication,
} from '../../lib/api';
import AuthScreen from '../../components/AuthScreen';

interface NavItem {
  href: string;
  label: string;
  badge?: string;
  icon: (props: { className?: string }) => JSX.Element;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: 'Workspace',
    items: [
      {
        href: '/dashboard',
        label: 'Overview',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        href: '/candidate-profile',
        label: 'Career Profile',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
      {
        href: '/onboarding',
        label: 'Onboarding Wizard',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Intelligence & Jobs',
    items: [
      {
        href: '/job-recommendations',
        label: 'Jobs & Discovery',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
      },
      {
        href: '/job-match-intelligence',
        label: 'Match Intelligence',
        badge: 'AI',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
      {
        href: '/skill-gap-analyzer',
        label: 'Skill Gap Analyzer',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Resume Studio',
    items: [
      {
        href: '/resume-studio',
        label: 'Resume Studio',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
      },
      {
        href: '/resume-manager',
        label: 'Resume Upload',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        ),
      },
      {
        href: '/resume-analyzer',
        label: 'ATS Diagnostics',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        href: '/targeted-resume',
        label: 'Targeted Generator',
        badge: 'Auto',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        ),
      },
      {
        href: '/truth-engine',
        label: 'Truth Engine',
        badge: 'Grounded',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Pipeline & Interviews',
    items: [
      {
        href: '/application-assistant',
        label: 'Application Assistant',
        badge: 'MV3',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: '/application-tracker',
        label: 'Application Tracker',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
      {
        href: '/interview-center',
        label: 'Interview Center',
        badge: 'Atlas',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: '/follow-up-manager',
        label: 'Follow-Up Manager',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      {
        href: '/performance-analytics',
        label: 'Analytics & Rates',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        ),
      },
      {
        href: '/notifications',
        label: 'Notifications',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
      {
        href: '/billing',
        label: 'Plans & Billing',
        badge: 'PRO',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        ),
      },
      {
        href: '/settings-privacy',
        label: 'Privacy & Data',
        icon: ({ className = 'w-4 h-4' }) => (
          <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        ),
      },
    ],
  },
];

type ConsentState = 'loading' | 'required' | 'accepted' | 'unavailable';
type AuthState = 'loading' | 'required' | 'authenticated' | 'local' | 'unavailable';

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('loading');
  const [auth, setAuth] = useState<AuthState>(usesCloudAuthentication ? 'loading' : 'local');
  const [userEmail, setUserEmail] = useState<string>('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      if (active) {
        setAuth(session ? 'authenticated' : 'required');
        if (session?.user?.email) setUserEmail(session.user.email);
      }
    });

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setAuth('unavailable');
        setMessage(`Could not restore your sign-in: ${error.message}`);
      } else {
        setAuth(data.session ? 'authenticated' : 'required');
        if (data.session?.user?.email) setUserEmail(data.session.user.email);
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

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  // Get active page title for header breadcrumb
  let activeTitle = 'Workspace Overview';
  for (const cat of navCategories) {
    for (const item of cat.items) {
      if (pathname === item.href) {
        activeTitle = item.label;
        break;
      }
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

  // Sidebar Component for both desktop and mobile drawer
  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      {/* Brand & Workspace Header */}
      <div>
        <div className="px-5 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <span className="text-white font-black text-lg tracking-wider">P</span>
            </div>
            <div>
              <span className="text-xs font-bold text-white tracking-tight block">
                PROGENI <span className="text-indigo-400 font-extrabold">AUTOAPPLY</span>
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold block">
                Candidate Suite
              </span>
            </div>
          </Link>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-950/90 text-indigo-300 border border-indigo-700/60">
            PRO
          </span>
        </div>

        {/* Categorized Navigation */}
        <div className="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-210px)] custom-scrollbar">
          {navCategories.map((category) => (
            <div key={category.title}>
              <h3 className="px-3 mb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {category.title}
              </h3>
              <nav className="space-y-0.5">
                {category.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 group ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-white font-semibold border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={`transition-colors ${
                            active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            active
                              ? 'bg-indigo-500/30 text-indigo-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* User Session & Status Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2.5 mb-3 px-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-indigo-500/20">
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-200 block truncate">
              {userEmail || 'Active Candidate'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 truncate">
                {usesCloudAuthentication ? 'MongoDB Atlas Connected' : 'Local Workspace'}
              </span>
            </div>
          </div>
        </div>

        {usesCloudAuthentication && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void leaveAccount()}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-900/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{busy ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex antialiased">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl">
        <SidebarContent />
      </aside>

      {/* MOBILE DRAWER BACKDROP & SIDEBAR */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 z-50 shadow-2xl flex flex-col">
            <div className="flex justify-end p-2 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* ENTERPRISE TOPBAR */}
        <header className="sticky top-0 z-20 h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              aria-label="Open Navigation Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb Module Title */}
            <div className="flex items-center gap-2 text-xs">
              <Link href="/dashboard" className="text-slate-400 hover:text-slate-200 transition-colors font-medium">
                Workspace
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-white font-semibold">{activeTitle}</span>
            </div>
          </div>

          {/* Right Header Status & Action Controls */}
          <div className="flex items-center gap-3">
            {/* Live Sync Status Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{usesCloudAuthentication ? 'Cloud Atlas: Live' : 'Local First'}</span>
            </div>

            {/* Quick Action Link */}
            <Link
              href="/targeted-resume"
              className="hidden sm:inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/20 transition-all duration-150 active:scale-95"
            >
              <span>🎯</span>
              <span>Targeted Resume</span>
            </Link>

            {/* Notifications Shortcut */}
            <Link
              href="/notifications"
              className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
              title="Notifications"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />
            </Link>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
