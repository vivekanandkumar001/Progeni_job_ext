'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface LandingHeaderProps {
  isAuthenticated: boolean;
  openAuth: (mode: 'sign-in' | 'sign-up') => void;
  primaryAction: () => void;
}

interface FeatureItem {
  title: string;
  desc: string;
  href: string;
  badge?: string;
  icon: LucideIcon;
  color: string;
}

const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: 'Truth Engine',
    desc: 'Locks verified claims and prevents AI hallucinations',
    href: '#truth-engine',
    badge: 'Core Guardrail',
    icon: ShieldCheck,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    title: 'Deterministic Matcher',
    desc: '6-dimension fit evaluation with explainable audit trail',
    href: '#features',
    badge: 'Explainable',
    icon: Gauge,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    title: 'Chrome Extension (MV3)',
    desc: 'Instant job extraction on LinkedIn, Indeed & ATS boards',
    href: '#extension',
    badge: 'Manifest V3',
    icon: Chrome,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  {
    title: 'ATS Resume Studio',
    desc: 'Tailor parser-safe resumes without inventing keywords',
    href: '#features',
    badge: 'Zero Fabrication',
    icon: FileSearch,
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  },
  {
    title: 'Pipeline Tracker',
    desc: 'Track applications from detected to final interview',
    href: '#features',
    icon: Layers,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
];

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works', id: 'how-it-works' },
  { label: 'Truth Engine', href: '#truth-engine', id: 'truth-engine', isPill: true },
  { label: 'Features', href: '#features', id: 'features', hasDropdown: true },
  { label: 'Integrations', href: '#integrations', id: 'integrations' },
  { label: 'Pricing', href: '#pricing', id: 'pricing' },
  { label: 'FAQ', href: '#faq', id: 'faq' },
];

export default function LandingHeader({
  isAuthenticated,
  openAuth,
  primaryAction,
}: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Scroll detection for sticky header elevation & active section spy
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);

      // Simple active section detection
      const sections = ['how-it-works', 'truth-engine', 'features', 'integrations', 'pricing', 'faq'];
      const scrollPos = window.scrollY + 120;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click or escape
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
    };
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    if (href.startsWith('#')) {
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      {/* =========================================================================
          TOP NOTIFICATION BANNER (SLIM ANNOUNCEMENT)
          ========================================================================= */}
      <div className="relative z-50 border-b border-outline-variant/60 bg-surface-subtle/90 px-4 py-1.5 text-xs backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-[11px] sm:text-[11.5px]">
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-container/70 px-2 py-0.5 font-bold uppercase tracking-wider text-on-success-container">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              MV3 CERTIFIED
            </span>
            <span className="truncate text-on-surface-variant font-medium">
              Human-in-the-loop guarantee · Grounded in verified facts · Zero blind submissions
            </span>
          </div>

          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <a
              href="#integrations"
              className="font-medium text-on-surface-variant transition-colors hover:text-primary"
            >
              7 ATS Supported
            </a>
            <span className="text-outline">·</span>
            <a
              href="#truth-engine"
              className="inline-flex items-center gap-1 font-semibold text-primary transition-opacity hover:opacity-80"
            >
              Explore Truth Engine
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN FLOATING/STICKY HEADER
          ========================================================================= */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          scrolled
            ? 'border-b border-outline-variant/80 bg-background/90 shadow-soft backdrop-blur-xl'
            : 'border-b border-outline-variant/40 bg-background/70 backdrop-blur-md'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* BRAND LOGO */}
          <Link
            href="/"
            className="group flex items-center gap-3 transition-transform focus:outline-none"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-[1.5px] shadow-md shadow-indigo-500/20 transition-all duration-300 group-hover:scale-105 group-hover:shadow-indigo-500/35">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-surface font-extrabold text-primary transition-colors group-hover:bg-transparent group-hover:text-white">
                <span className="text-[17px] font-black tracking-tighter">P</span>
              </div>
            </div>

            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-extrabold tracking-tight text-on-surface">
                  PROGENI
                </span>
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-[14px] font-black tracking-tight text-transparent">
                  AUTOAPPLY
                </span>
              </div>
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/80">
                Truth Engine & Cockpit
              </span>
            </div>
          </Link>

          {/* DESKTOP NAVIGATION MENU */}
          <nav className="hidden items-center gap-1 text-[13px] font-medium lg:flex">
            {/* How it Works */}
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#how-it-works');
              }}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                activeSection === 'how-it-works'
                  ? 'bg-primary-container/60 font-semibold text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
              }`}
            >
              How it works
            </a>

            {/* Truth Engine Flagship Pill */}
            <a
              href="#truth-engine"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#truth-engine');
              }}
              className={`group flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                activeSection === 'truth-engine'
                  ? 'bg-emerald-500/15 font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.2} />
              <span>Truth Engine</span>
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                Core
              </span>
            </a>

            {/* Features Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                onMouseEnter={() => setDropdownOpen(true)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 transition-all ${
                  dropdownOpen || activeSection === 'features'
                    ? 'bg-surface-variant text-on-surface font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
                }`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <span>Platform</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    dropdownOpen ? 'rotate-180 text-primary' : 'text-on-surface-variant'
                  }`}
                />
              </button>

              {/* DROPDOWN POPOVER */}
              {dropdownOpen && (
                <div
                  onMouseLeave={() => setDropdownOpen(false)}
                  className="absolute left-1/2 top-full mt-2 w-96 -translate-x-1/2 overflow-hidden rounded-2xl border border-outline-variant bg-surface p-2 shadow-card ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    Platform Capabilities
                  </div>

                  <div className="space-y-1">
                    {FEATURE_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.title}
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNavClick(item.href);
                          }}
                          className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-subtle"
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${item.color} transition-transform group-hover:scale-105`}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12.5px] font-semibold text-on-surface group-hover:text-primary transition-colors">
                                {item.title}
                              </span>
                              {item.badge && (
                                <span className="rounded-full bg-surface-variant px-1.5 py-0.5 text-[9px] font-bold text-on-surface-variant">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] leading-tight text-on-surface-variant line-clamp-1">
                              {item.desc}
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="mt-2 rounded-xl border border-outline-variant/60 bg-surface-subtle p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-on-surface-variant">
                        Strict candidate control
                      </span>
                      <a
                        href="#how-it-works"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavClick('#how-it-works');
                        }}
                        className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Read architecture
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Integrations */}
            <a
              href="#integrations"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#integrations');
              }}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                activeSection === 'integrations'
                  ? 'bg-primary-container/60 font-semibold text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
              }`}
            >
              Integrations
            </a>

            {/* Pricing */}
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#pricing');
              }}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                activeSection === 'pricing'
                  ? 'bg-primary-container/60 font-semibold text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
              }`}
            >
              Pricing
            </a>

            {/* FAQ */}
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                handleNavClick('#faq');
              }}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                activeSection === 'faq'
                  ? 'bg-primary-container/60 font-semibold text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant/60 hover:text-on-surface'
              }`}
            >
              FAQ
            </a>
          </nav>

          {/* RIGHT ACTION HUB */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* THEME TOGGLE */}
            <div className="border-r border-outline-variant pr-2">
              <ThemeToggle size="sm" />
            </div>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="button button-primary button-sm shadow-sm transition-all hover:shadow-primary/20"
              >
                <span>Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('sign-in')}
                  className="hidden rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface md:block"
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() => openAuth('sign-up')}
                  className="button button-primary button-sm relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span>Start Free</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              </>
            )}

            {/* MOBILE HAMBURGER BUTTON */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface transition-colors hover:bg-surface-variant lg:hidden"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-on-surface" />
              ) : (
                <Menu className="h-5 w-5 text-on-surface" />
              )}
            </button>
          </div>
        </div>

        {/* =========================================================================
            MOBILE MENU DRAWER & SHEET OVERLAY
            ========================================================================= */}
        {mobileMenuOpen && (
          <div className="fixed inset-x-0 top-[calc(4rem+1.8rem)] bottom-0 z-40 flex flex-col bg-background/95 backdrop-blur-2xl border-b border-outline-variant lg:hidden overflow-y-auto">
            <div className="flex-1 px-5 py-6 space-y-6">
              {/* SECTION: PLATFORM HIGHLIGHTS */}
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/60">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    Platform & Truth Engine
                  </span>
                  <span className="rounded-full bg-success-container px-2 py-0.5 text-[9px] font-bold text-on-success-container">
                    MV3 Grounded
                  </span>
                </div>

                <div className="grid gap-2">
                  {FEATURE_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.title}
                        href={item.href}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavClick(item.href);
                        }}
                        className="flex items-center gap-3 rounded-xl border border-outline-variant/50 bg-surface p-3 transition-colors active:bg-surface-variant"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.color}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-on-surface">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="text-[9px] font-semibold text-on-surface-variant">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate">
                            {item.desc}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* SECTION: PAGE NAVIGATION */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  Explore Landing Page
                </span>
                <div className="mt-2 divide-y divide-outline-variant/60 rounded-2xl border border-outline-variant/70 bg-surface">
                  {[
                    { label: 'How It Works (3 Steps)', href: '#how-it-works', icon: Compass },
                    { label: 'Works With 7 ATS Partners', href: '#integrations', icon: Chrome },
                    { label: 'Transparent Pricing Plans', href: '#pricing', icon: CreditCard },
                    { label: 'Frequently Asked Questions', href: '#faq', icon: HelpCircle },
                  ].map((link) => {
                    const LinkIcon = link.icon;
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavClick(link.href);
                        }}
                        className="flex items-center justify-between p-3.5 text-[13px] font-medium text-on-surface transition-colors active:bg-surface-variant"
                      >
                        <div className="flex items-center gap-2.5">
                          <LinkIcon className="h-4 w-4 text-primary" />
                          <span>{link.label}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant/60" />
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* ACTION BUTTONS IN MOBILE MENU */}
              <div className="space-y-2.5 pt-2">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="button button-primary w-full h-11 text-[13px]"
                  >
                    Open Workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openAuth('sign-up');
                      }}
                      className="button button-primary w-full h-11 text-[13px]"
                    >
                      Create Free Workspace
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        openAuth('sign-in');
                      }}
                      className="button button-secondary w-full h-11 text-[13px]"
                    >
                      Sign In to Account
                    </button>
                  </>
                )}
              </div>

              {/* FOOTER BADGE IN MOBILE MENU */}
              <div className="flex items-center justify-center gap-2 text-center text-[11px] text-on-surface-variant pb-6">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                <span>Deterministic matching · 100% auditable</span>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
