'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  Chrome,
  Compass,
  CreditCard,
  FileSearch,
  Gauge,
  HelpCircle,
  Layers,
  LucideIcon,
  Menu,
  Rocket,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface LandingHeaderProps {
  isAuthenticated: boolean;
  openAuth: (mode: 'sign-in' | 'sign-up') => void;
  primaryAction: () => void;
}

interface MenuItem {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  tone: string;
}

const PLATFORM_ITEMS: MenuItem[] = [
  {
    title: 'Truth Engine',
    desc: 'Verified claims, zero hallucinations',
    href: '#truth-engine',
    icon: ShieldCheck,
    badge: 'Core',
    tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
  },
  {
    title: 'Match intelligence',
    desc: 'Six-dimension explainable fit scoring',
    href: '#features',
    icon: Gauge,
    tone: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-400',
  },
  {
    title: 'Chrome extension',
    desc: 'Detect and autofill across 7 ATS boards',
    href: '#extension',
    icon: Chrome,
    badge: 'MV3',
    tone: 'text-sky-600 bg-sky-500/10 border-sky-500/20 dark:text-sky-400',
  },
  {
    title: 'ATS integrations',
    desc: 'Greenhouse, Lever, Ashby, Workday',
    href: '#integrations',
    icon: Layers,
    tone: 'text-violet-600 bg-violet-500/10 border-violet-500/20 dark:text-violet-400',
  },
];

const EXPLORE_ITEMS: MenuItem[] = [
  {
    title: 'How it works',
    desc: 'Three steps from profile to interview',
    href: '#how-it-works',
    icon: Compass,
    tone: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400',
  },
  {
    title: 'Resume studio',
    desc: 'Parser-safe, targeted resumes',
    href: '#features',
    icon: FileSearch,
    tone: 'text-fuchsia-600 bg-fuchsia-500/10 border-fuchsia-500/20 dark:text-fuchsia-400',
  },
  {
    title: 'Pricing',
    desc: 'Free forever, upgrade when ready',
    href: '#pricing',
    icon: CreditCard,
    tone: 'text-teal-600 bg-teal-500/10 border-teal-500/20 dark:text-teal-400',
  },
  {
    title: 'FAQ',
    desc: 'Guardrails, privacy and support',
    href: '#faq',
    icon: HelpCircle,
    tone: 'text-slate-600 bg-slate-500/10 border-slate-500/20 dark:text-slate-300',
  },
  {
    title: 'Get started',
    desc: 'Create your workspace in minutes',
    href: '#get-started',
    icon: Rocket,
    tone: 'text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400',
  },
];

const SECTION_IDS = [
  'extension',
  'integrations',
  'how-it-works',
  'features',
  'truth-engine',
  'pricing',
  'faq',
  'get-started',
];

const DIRECT_LINKS = [
  { label: 'How it works', href: '#how-it-works', id: 'how-it-works' },
  { label: 'Truth Engine', href: '#truth-engine', id: 'truth-engine', core: true },
  { label: 'Pricing', href: '#pricing', id: 'pricing' },
  { label: 'FAQ', href: '#faq', id: 'faq' },
];

export default function LandingHeader({
  isAuthenticated,
  openAuth,
  primaryAction,
}: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  function openPlatformMenu() {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setDropdownOpen(true);
  }

  function schedulePlatformClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setDropdownOpen(false);
    }, 160);
  }

  // Sticky elevation, scroll progress and active-section spy in one listener.
  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0);

      let current = '';
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && y + 150 >= el.offsetTop) current = id;
      }
      setActiveSection(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Dismiss menus on outside click or Escape.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Lock background scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  function handleNavClick(href: string) {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (!href.startsWith('#')) return;
    const target = document.getElementById(href.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }

  const platformActive =
    dropdownOpen ||
    (activeSection !== '' &&
      ['features', 'extension', 'integrations'].includes(activeSection));

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-2 sm:px-4 sm:pt-2.5">
        <div className="mx-auto max-w-6xl">
          <div className={`landing-header-bar${scrolled ? ' is-scrolled' : ''}`}>
            <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
              {/* Brand */}
              <Link
                href="/"
                className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none"
                aria-label="Progeni AutoApply home"
              >
                <span className="landing-brand-mark" aria-hidden>
                  <span>P</span>
                </span>
                <span className="flex items-baseline gap-1 leading-none">
                  <span className="text-[13.5px] font-extrabold tracking-tight text-on-surface">
                    PROGENI
                  </span>
                  <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-[13.5px] font-extrabold tracking-tight text-transparent">
                    AUTOAPPLY
                  </span>
                </span>
              </Link>

              {/* Desktop navigation */}
              <nav
                className="ml-1 hidden items-center gap-0.5 lg:flex"
                aria-label="Landing sections"
              >
                <a
                  href="#how-it-works"
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavClick('#how-it-works');
                  }}
                  className={`landing-nav-link${activeSection === 'how-it-works' ? ' active' : ''}`}
                >
                  How it works
                </a>

                <a
                  href="#truth-engine"
                  onClick={(event) => {
                    event.preventDefault();
                    handleNavClick('#truth-engine');
                  }}
                  className={`landing-nav-link${activeSection === 'truth-engine' ? ' active' : ''}`}
                >
                  <ShieldCheck size={13} strokeWidth={2.2} className="text-emerald-500" />
                  Truth Engine
                </a>

                <div
                  className="relative"
                  ref={dropdownRef}
                  onMouseEnter={openPlatformMenu}
                  onMouseLeave={schedulePlatformClose}
                >
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((open) => !open)}
                    className={`landing-nav-link${platformActive ? ' active' : ''}`}
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                  >
                    Platform
                    <ChevronDown
                      size={13}
                      className={`transition-transform duration-200${dropdownOpen ? ' rotate-180 text-primary' : ''}`}
                    />
                  </button>

                  {dropdownOpen && (
                    <div className="landing-mega" role="menu">
                      <div className="landing-mega-head">
                        <div>
                          <span className="eyebrow" style={{ margin: 0 }}>
                            Everything in one workspace
                          </span>
                          <p>Every capability you need to apply with evidence, not guesswork.</p>
                        </div>
                        <span className="chip chip-success">
                          <span className="live-dot" aria-hidden />
                          MV3 certified
                        </span>
                      </div>

                      <div className="landing-mega-grid">
                        <div>
                          <span className="landing-mega-label">Capabilities</span>
                          {PLATFORM_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                              <a
                                key={item.title}
                                href={item.href}
                                role="menuitem"
                                onClick={(event) => {
                                  event.preventDefault();
                                  handleNavClick(item.href);
                                }}
                                className="landing-mega-item"
                              >
                                <span className={`landing-mega-icon ${item.tone}`}>
                                  <Icon size={16} strokeWidth={2} />
                                </span>
                                <span className="landing-mega-copy">
                                  <strong>
                                    {item.title}
                                    {item.badge && <em>{item.badge}</em>}
                                  </strong>
                                  <small>{item.desc}</small>
                                </span>
                              </a>
                            );
                          })}
                        </div>

                        <div>
                          <span className="landing-mega-label">Explore</span>
                          {EXPLORE_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                              <a
                                key={item.title}
                                href={item.href}
                                role="menuitem"
                                onClick={(event) => {
                                  event.preventDefault();
                                  handleNavClick(item.href);
                                }}
                                className="landing-mega-item compact"
                              >
                                <span className={`landing-mega-icon ${item.tone}`}>
                                  <Icon size={15} strokeWidth={2} />
                                </span>
                                <span className="landing-mega-copy">
                                  <strong>{item.title}</strong>
                                  <small>{item.desc}</small>
                                </span>
                              </a>
                            );
                          })}
                        </div>
                      </div>

                      <div className="landing-mega-foot">
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles size={13} className="text-primary" />
                          Human-in-the-loop · nothing submits without you
                        </span>
                        <a
                          href="#get-started"
                          onClick={(event) => {
                            event.preventDefault();
                            handleNavClick('#get-started');
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-primary"
                        >
                          Start free
                          <ArrowRight size={12} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {DIRECT_LINKS.slice(2).map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(event) => {
                      event.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className={`landing-nav-link${activeSection === link.id ? ' active' : ''}`}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                <ThemeToggle size="sm" />

                <span className="hidden h-5 w-px bg-outline-variant md:block" aria-hidden />

                {isAuthenticated ? (
                  <Link href="/dashboard" className="landing-cta">
                    <span>Workspace</span>
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuth('sign-in')}
                      className="hidden rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface md:block"
                    >
                      Sign in
                    </button>

                    <button type="button" onClick={primaryAction} className="landing-cta hidden sm:inline-flex">
                      <span>Start free</span>
                      <ArrowRight size={14} />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((open) => !open)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface transition-colors hover:bg-surface-variant lg:hidden"
                  aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>

            <div className="landing-progress" aria-hidden>
              <span style={{ transform: `scaleX(${progress})` }} />
            </div>
          </div>
        </div>

        {/* Mobile sheet */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[72px] z-40 bg-background/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              role="presentation"
            />
            <div className="fixed inset-x-3 top-[72px] z-50 max-h-[calc(100vh-84px)] overflow-y-auto rounded-2xl border border-outline-variant bg-surface shadow-card lg:hidden">
              <div className="grid gap-5 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (isAuthenticated) {
                        window.location.href = '/dashboard';
                      } else {
                        openAuth('sign-up');
                      }
                    }}
                    className="button button-primary h-10 text-[12.5px]"
                  >
                    {isAuthenticated ? 'Open workspace' : 'Start free'}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuth('sign-in');
                    }}
                    className="button button-secondary h-10 text-[12.5px]"
                  >
                    Sign in
                  </button>
                </div>

                <div>
                  <span className="landing-mega-label">Capabilities</span>
                  <div className="grid gap-1.5">
                    {PLATFORM_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.title}
                          href={item.href}
                          onClick={(event) => {
                            event.preventDefault();
                            handleNavClick(item.href);
                          }}
                          className="landing-mobile-item"
                        >
                          <span className={`landing-mega-icon ${item.tone}`}>
                            <Icon size={15} strokeWidth={2} />
                          </span>
                          <span className="landing-mega-copy">
                            <strong>{item.title}</strong>
                            <small>{item.desc}</small>
                          </span>
                          <ArrowRight size={13} className="ml-auto text-on-surface-variant/60" />
                        </a>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <span className="landing-mega-label">Explore the page</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXPLORE_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.title}
                          href={item.href}
                          onClick={(event) => {
                            event.preventDefault();
                            handleNavClick(item.href);
                          }}
                          className="landing-mobile-link"
                        >
                          <Icon size={14} className="text-primary" />
                          {item.title}
                        </a>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pb-1 text-[10.5px] text-on-surface-variant">
                  <ShieldCheck size={13} className="text-success" />
                  Deterministic matching · 100% auditable
                </div>
              </div>
            </div>
          </>
        )}
      </header>
    </>
  );
}
