'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Moon,
  PlugZap,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/user-management', label: 'User management', icon: Users },
      { href: '/support-reports', label: 'Support reports', icon: LifeBuoy },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/analytics-reports', label: 'Analytics & reports', icon: BarChart3 },
      { href: '/platform-adapter-management', label: 'Platform adapters', icon: PlugZap },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: '/compliance-automation-policy', label: 'Compliance & policy', icon: ShieldCheck },
      { href: '/system-settings-monitoring', label: 'System monitoring', icon: Activity },
    ],
  },
];

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Overview', subtitle: 'Revenue, usage & abuse control' },
  '/user-management': { title: 'User management', subtitle: 'Identity, roles & account status' },
  '/support-reports': { title: 'Support reports', subtitle: 'Candidate escalations & triage' },
  '/analytics-reports': { title: 'Analytics & reports', subtitle: 'Product and platform insight' },
  '/platform-adapter-management': { title: 'Platform adapters', subtitle: 'ATS coverage & extraction policy' },
  '/compliance-automation-policy': { title: 'Compliance & policy', subtitle: 'Automation guardrails & audit' },
  '/system-settings-monitoring': { title: 'System monitoring', subtitle: 'Service health & configuration' },
};

const THEME_KEY = 'progeni.admin-theme';

function isStandalone(pathname: string | null) {
  return pathname === '/login' || pathname === '/unauthorized' || pathname === '/';
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable; theme still applies for this session.
    }
    setDark(next);
  }

  function signOut() {
    try {
      localStorage.removeItem('progeni.adminToken');
      localStorage.removeItem('admin_token');
    } catch {
      // Ignore storage failures.
    }
    window.location.replace('/login');
  }

  if (isStandalone(pathname)) {
    return <>{children}</>;
  }

  const meta = PAGE_META[pathname ?? ''] ?? {
    title: 'Admin console',
    subtitle: 'Progeni operations',
  };

  return (
    <div className={`admin-shell page-canvas${navOpen ? ' nav-open' : ''}`}>
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-head">
          <Link href="/dashboard" className="admin-brand">
            <span className="admin-brand-mark" aria-hidden>
              P
            </span>
            <span className="admin-brand-copy">
              <strong>Progeni</strong>
              <span>Admin console</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button admin-drawer-toggle"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="admin-nav">
          {NAV_GROUPS.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-label">{group.label}</span>
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav-link${active ? ' active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={16} strokeWidth={1.9} />
                    <span>{item.label}</span>
                    <ChevronRight
                      size={13}
                      style={{ marginLeft: 'auto', opacity: active ? 0.7 : 0.25 }}
                    />
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <strong>
            <span className="live-dot" aria-hidden />
            Privileged session
          </strong>
          <p>
            Actions taken here are written to the immutable administrative audit log.
          </p>
          <button type="button" className="button button-secondary button-sm" onClick={signOut}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <div
        className="admin-drawer-scrim"
        role="presentation"
        onClick={() => setNavOpen(false)}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="icon-button admin-drawer-toggle"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
            >
              <Menu size={17} />
            </button>
            <div className="admin-topbar-title">
              <strong>{meta.title}</strong>
              <span>{meta.subtitle}</span>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <span className="chip chip-success" title="Administrative session active">
              <span className="live-dot" aria-hidden />
              Live
            </span>
            <a
              className="icon-button"
              href={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}
              target="_blank"
              rel="noreferrer"
              aria-label="Open candidate dashboard"
              title="Open candidate dashboard"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
