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
import ThemeToggle from '../../components/ThemeToggle';

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
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6 text-on-surface">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/20">
            P
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            Connecting to workspace
          </div>
          <h1 className="text-lg font-semibold">Restoring your session</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
            {usesCloudAuthentication
              ? 'Authenticating with the cloud workspace and syncing candidate data…'
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
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-6 text-on-surface">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/20">
            P
          </div>
          <h1 className="text-lg font-semibold">Loading Career Intelligence</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">
            Retrieving candidate preferences and verification state…
          </p>
        </div>
      </main>
    );
  }

  if (consent !== 'accepted' && pathname !== '/onboarding') {
    return (
      <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6 text-on-surface">
        <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-2xl" />
        <section className="relative z-10 w-full max-w-xl rounded-3xl border border-outline-variant bg-surface p-8 shadow-card sm:p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-md shadow-indigo-500/20">
              P
            </div>
            <div>
              <span className="block text-base font-semibold text-on-surface">
                PROGENI <span className="text-primary">AUTOAPPLY</span>
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
                Privacy & Security Guardrails
              </span>
            </div>
          </div>
          {consent === 'unavailable' ? (
            <div>
              <h1 className="mb-3 text-2xl font-semibold">
                {usesCloudAuthentication ? 'Workspace Unavailable' : 'Local Backend Unavailable'}
              </h1>
              <p className="mb-6 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                {message || 'Start the backend from the backend folder, then retry.'}
              </p>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                disabled={busy}
                onClick={() => void checkConsent()}
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
                <span aria-hidden>🛡️</span> Zero Data Misuse Guarantee
              </div>
              <h1 className="mb-3 text-2xl font-semibold">Before you build your workspace</h1>
              <p className="mb-4 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                Your career profile, job targets, match scores, and application tracker
                {usesCloudAuthentication
                  ? ' are securely persisted in your Progeni cloud workspace on MongoDB Atlas.'
                  : ' stay securely on this device.'}
                {' '}The extension reads a job page only when you explicitly click Detect.
              </p>
              <div className="mb-6 space-y-3 rounded-2xl border border-outline-variant bg-surface-subtle p-4">
                <div className="flex items-start gap-2.5 text-xs text-on-surface-variant">
                  <span className="mt-0.5 font-semibold text-success">✓</span>
                  <span><strong className="font-semibold text-on-surface">Zero Hallucinations:</strong> Resumes and answers are grounded strictly in your confirmed master records.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-on-surface-variant">
                  <span className="mt-0.5 font-semibold text-success">✓</span>
                  <span><strong className="font-semibold text-on-surface">Human In The Loop:</strong> Applications are never auto-submitted without your explicit digital approval.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-on-surface-variant">
                  <span className="mt-0.5 font-semibold text-success">✓</span>
                  <span><strong className="font-semibold text-on-surface">Data Sovereignty:</strong> You can export or permanently wipe your workspace records anytime.</span>
                </div>
              </div>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
                disabled={busy}
                onClick={() => void giveConsent()}
              >
                {busy ? 'Saving choice…' : 'I Understand & Agree — Continue to Dashboard'}
              </button>
              {message && <p className="mt-3 text-xs text-danger" role="alert">{message}</p>}
            </div>
          )}
        </section>
      </main>
    );
  }

  // Sidebar Component for both desktop and mobile drawer
  const SidebarContent = () => (
    <div className="flex h-full flex-col justify-between">
      {/* Brand & Workspace Header */}
      <div>
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-5">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold tracking-wider text-white shadow-md shadow-indigo-500/20 transition-transform duration-200 group-hover:scale-105">
              P
            </div>
            <div>
              <span className="block text-xs font-semibold tracking-tight text-on-surface">
                PROGENI <span className="font-semibold text-primary">AUTOAPPLY</span>
              </span>
              <span className="block text-[9px] font-medium uppercase tracking-widest text-on-surface-variant">
                Candidate Suite
              </span>
            </div>
          </Link>
          <span className="inline-flex items-center rounded border border-primary/30 bg-primary-container px-1.5 py-0.5 text-[10px] font-semibold text-on-primary-container">
            PRO
          </span>
        </div>

        {/* Categorized Navigation */}
        <div className="custom-scrollbar max-h-[calc(100vh-210px)] space-y-6 overflow-y-auto px-3 py-4">
          {navCategories.map((category) => (
            <div key={category.title}>
              <h3 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/80">
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
                      className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors duration-150 ${ active ? 'border border-primary/25 bg-primary-container font-semibold text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-subtle hover:text-on-surface' }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={`transition-colors ${ active ? 'text-primary' : 'text-on-surface-variant/80 group-hover:text-on-surface' }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${ active ? 'bg-primary/15 text-primary' : 'bg-surface-variant text-on-surface-variant' }`}
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
      <div className="border-t border-outline-variant bg-surface-subtle/60 p-4">
        <div className="mb-3 flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20">
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'C'}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-on-surface">
              {userEmail || 'Active Candidate'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="truncate text-[10px] text-on-surface-variant">
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:border-danger/40 hover:bg-danger-container hover:text-on-danger-container"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{busy ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-on-surface antialiased">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-outline-variant bg-surface/95 backdrop-blur-xl lg:flex">
        <SidebarContent />
      </aside>

      {/* MOBILE DRAWER BACKDROP & SIDEBAR */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-outline-variant bg-surface shadow-card">
            <div className="flex justify-end border-b border-outline-variant p-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* ENTERPRISE TOPBAR */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-outline-variant bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface lg:hidden"
              aria-label="Open Navigation Menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb Module Title */}
            <div className="flex items-center gap-2 text-xs">
              <Link href="/dashboard" className="font-medium text-on-surface-variant transition-colors hover:text-on-surface">
                Workspace
              </Link>
              <span className="text-on-surface-variant/50">/</span>
              <span className="font-semibold text-on-surface">{activeTitle}</span>
            </div>
          </div>

          {/* Right Header Status & Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Sync Status Pill */}
            <div className="hidden items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-medium text-on-surface-variant sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span>{usesCloudAuthentication ? 'Cloud Atlas: Live' : 'Local First'}</span>
            </div>

            {/* Quick Action Link */}
            <Link
              href="/targeted-resume"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-95 sm:inline-flex"
            >
              <span aria-hidden>🎯</span>
              <span>Targeted Resume</span>
            </Link>

            {/* Theme control */}
            <ThemeToggle size="sm" />

            {/* Notifications Shortcut */}
            <Link
              href="/notifications"
              className="relative rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              title="Notifications"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            </Link>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
