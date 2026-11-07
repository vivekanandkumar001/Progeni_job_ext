'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronRight,
  Compass,
  CreditCard,
  FileText,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  Menu,
  MousePointerClick,
  Radar,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
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
  icon: LucideIcon;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    title: 'Workspace',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/candidate-profile', label: 'Career Profile', icon: UserRound },
      { href: '/onboarding', label: 'Onboarding Wizard', icon: Sparkles },
    ],
  },
  {
    title: 'Intelligence & Jobs',
    items: [
      { href: '/job-recommendations', label: 'Jobs & Discovery', icon: Compass },
      { href: '/job-match-intelligence', label: 'Match Intelligence', badge: 'AI', icon: Radar },
      { href: '/skill-gap-analyzer', label: 'Skill Gap Analyzer', icon: TrendingUp },
    ],
  },
  {
    title: 'Resume Studio',
    items: [
      { href: '/resume-studio', label: 'Resume Studio', icon: FileText },
      { href: '/resume-manager', label: 'Resume Upload', icon: UploadCloud },
      { href: '/resume-analyzer', label: 'ATS Diagnostics', icon: ScanSearch },
      { href: '/targeted-resume', label: 'Targeted Resume', badge: 'Auto', icon: WandSparkles },
      { href: '/truth-engine', label: 'Truth Engine', icon: ShieldCheck },
    ],
  },
  {
    title: 'Pipeline & Interviews',
    items: [
      { href: '/application-assistant', label: 'Application Assistant', icon: MousePointerClick },
      { href: '/application-tracker', label: 'Application Tracker', icon: KanbanSquare },
      { href: '/interview-center', label: 'Interview Center', icon: CalendarClock },
      { href: '/follow-up-manager', label: 'Follow-Up Manager', icon: Bell },
    ],
  },
  {
    title: 'Account & Billing',
    items: [
      { href: '/performance-analytics', label: 'Analytics & Rates', icon: BarChart3 },
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/billing', label: 'Plans & Billing', badge: 'PRO', icon: CreditCard },
      { href: '/settings-privacy', label: 'Privacy & Data', icon: Lock },
    ],
  },
];

const allItems = navCategories.flatMap((category) => category.items);

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
  const [navQuery, setNavQuery] = useState('');

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
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
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

  useEffect(() => {
    setMobileMenuOpen(false);
    setNavQuery('');
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

  const activeItem = allItems.find((item) => pathname === item.href);
  const activeTitle = activeItem?.label ?? 'Workspace Overview';

  const visibleCategories = useMemo(() => {
    const query = navQuery.trim().toLowerCase();
    if (!query) return navCategories;
    return navCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.label.toLowerCase().includes(query)),
      }))
      .filter((category) => category.items.length > 0);
  }, [navQuery]);

  const initials = userEmail ? userEmail.charAt(0).toUpperCase() : 'P';

  if (auth === 'loading') {
    return (
      <main className="page-canvas flex min-h-screen w-full flex-col items-center justify-center p-6 text-on-surface">
        <div className="animate-rise flex max-w-sm flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-xl font-extrabold text-white shadow-lg shadow-indigo-500/25">
            P
          </div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[11px] font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            Connecting to workspace
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Restoring your session</h1>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
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
      <main className="page-canvas flex min-h-screen w-full flex-col items-center justify-center p-6 text-on-surface">
        <div className="flex max-w-sm flex-col items-center text-center">
          <div className="mb-6 h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500" />
          <h1 className="text-lg font-semibold tracking-tight">Loading career intelligence</h1>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
            Retrieving candidate preferences and verification state…
          </p>
        </div>
      </main>
    );
  }

  if (consent !== 'accepted' && pathname !== '/onboarding') {
    return (
      <main className="page-canvas relative flex min-h-screen w-full items-center justify-center p-6 text-on-surface">
        <section className="animate-rise relative z-10 w-full max-w-xl rounded-3xl border border-outline-variant bg-surface p-8 shadow-card sm:p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-lg font-extrabold text-white shadow-md shadow-indigo-500/25">
              P
            </div>
            <div>
              <span className="block text-base font-semibold tracking-tight text-on-surface">
                PROGENI <span className="text-primary">AUTOAPPLY</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                Privacy & Security Guardrails
              </span>
            </div>
          </div>
          {consent === 'unavailable' ? (
            <div>
              <h1 className="mb-3 text-2xl font-semibold tracking-tight">
                {usesCloudAuthentication ? 'Workspace unavailable' : 'Local backend unavailable'}
              </h1>
              <p className="mb-6 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                {message || 'Start the backend from the backend folder, then retry.'}
              </p>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                disabled={busy}
                onClick={() => void checkConsent()}
              >
                Retry connection
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
                <ShieldCheck className="h-3.5 w-3.5" />
                Zero data misuse guarantee
              </div>
              <h1 className="mb-3 text-2xl font-semibold tracking-tight">Before you build your workspace</h1>
              <p className="mb-5 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                Your career profile, job targets, match scores, and application tracker
                {usesCloudAuthentication
                  ? ' are securely persisted in your Progeni cloud workspace on MongoDB Atlas.'
                  : ' stay securely on this device.'}{' '}
                The extension reads a job page only when you explicitly click Detect.
              </p>
              <div className="mb-6 space-y-3 rounded-2xl border border-outline-variant bg-surface-subtle p-4">
                {[
                  ['Zero hallucinations', 'Resumes and answers are grounded strictly in your confirmed master records.'],
                  ['Human in the loop', 'Applications are never auto-submitted without your explicit digital approval.'],
                  ['Data sovereignty', 'You can export or permanently wipe your workspace records anytime.'],
                ].map(([title, body]) => (
                  <div className="flex items-start gap-2.5 text-xs text-on-surface-variant" key={title}>
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-container text-[9px] font-bold text-success">
                      ✓
                    </span>
                    <span>
                      <strong className="font-semibold text-on-surface">{title}:</strong> {body}
                    </span>
                  </div>
                ))}
              </div>
              <button
                className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
                disabled={busy}
                onClick={() => void giveConsent()}
              >
                {busy ? 'Saving choice…' : 'I understand & agree — continue'}
              </button>
              {message && (
                <p className="mt-3 text-xs text-danger" role="alert">
                  {message}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-sm font-extrabold text-white shadow-md shadow-indigo-500/25 transition-transform duration-200 group-hover:scale-105">
            P
          </div>
          <div className="min-w-0">
            <span className="block text-[12.5px] font-bold tracking-tight text-on-surface">
              PROGENI <span className="text-primary">AUTOAPPLY</span>
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Candidate suite
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav search */}
      <div className="px-3 pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-subtle px-2.5 py-2 text-on-surface-variant transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder="Search workspace…"
            className="w-full border-0 bg-transparent p-0 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/70"
            aria-label="Search navigation"
          />
          {navQuery ? (
            <button type="button" onClick={() => setNavQuery('')} aria-label="Clear search">
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="hidden rounded border border-outline-variant bg-surface px-1 py-0.5 text-[9px] font-semibold text-on-surface-variant sm:block">
              /
            </kbd>
          )}
        </label>
      </div>

      {/* Navigation */}
      <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {visibleCategories.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-on-surface-variant">No pages match “{navQuery}”.</p>
        ) : (
          visibleCategories.map((category) => (
            <div key={category.title}>
              <h3 className="mb-1.5 px-2.5 text-[9.5px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/70">
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
                      className={`group relative flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-[12.5px] transition-colors duration-150 ${
                        active
                          ? 'bg-primary-container font-semibold text-on-primary-container'
                          : 'font-medium text-on-surface-variant hover:bg-surface-subtle hover:text-on-surface'
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />
                      )}
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon
                          className={`h-[16px] w-[16px] shrink-0 transition-colors ${
                            active ? 'text-primary' : 'text-on-surface-variant/80 group-hover:text-on-surface'
                          }`}
                          strokeWidth={1.9}
                        />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide ${
                            active
                              ? 'bg-primary/15 text-primary'
                              : 'bg-surface-variant text-on-surface-variant'
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
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-outline-variant p-3">
        <div className="mb-2 rounded-xl border border-outline-variant bg-gradient-to-br from-primary-container/70 to-surface-subtle p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-on-surface">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Extension paired
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-on-surface-variant">
            Detect jobs on Naukri, LinkedIn & Indeed directly from Chrome.
          </p>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 text-[11px] font-bold text-white shadow-sm shadow-indigo-500/25">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold text-on-surface">
              {userEmail || 'Active candidate'}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {usesCloudAuthentication ? 'Cloud workspace' : 'Local workspace'}
            </span>
          </div>
          {usesCloudAuthentication && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void leaveAccount()}
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-danger-container hover:text-on-danger-container"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-canvas flex min-h-screen bg-background text-on-surface antialiased">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] flex-col border-r border-outline-variant bg-surface/90 backdrop-blur-xl lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[86vw] flex-col border-r border-outline-variant bg-surface shadow-card">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[268px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-outline-variant bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl p-2 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-xs">
              <Link
                href="/dashboard"
                className="hidden shrink-0 font-medium text-on-surface-variant transition-colors hover:text-on-surface sm:block"
              >
                Workspace
              </Link>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-on-surface-variant/50 sm:block" />
              <span className="truncate text-[13px] font-semibold text-on-surface">{activeTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="hidden items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[11px] font-medium text-on-surface-variant md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {usesCloudAuthentication ? 'Cloud synced' : 'Local first'}
            </div>

            <Link
              href="/targeted-resume"
              className="hidden items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-2 text-[11.5px] font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all hover:-translate-y-px hover:bg-primary/90 active:translate-y-0 sm:inline-flex"
            >
              <WandSparkles className="h-3.5 w-3.5" />
              Tailor resume
            </Link>

            <ThemeToggle size="sm" />

            <Link
              href="/notifications"
              className="relative rounded-[10px] p-2 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
            </Link>

            <Link
              href="/candidate-profile"
              className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-[11px] font-bold text-white shadow-sm shadow-indigo-500/25 transition-transform hover:scale-105"
              title={userEmail || 'Active candidate'}
            >
              {initials}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
