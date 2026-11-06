'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthModal from '../components/AuthModal';
import ThemeToggle from '../components/ThemeToggle';
import { getSupabaseClient, usesCloudAuthentication } from '../lib/api';

const faqs = [
  {
    q: 'Does Progeni submit applications automatically without my review?',
    a: 'Never. Progeni operates with a strict human-in-the-loop guarantee. The AI matches jobs, generates targeted ATS resumes, and autofills screening questions, but requires your explicit approval before any form is submitted.',
  },
  {
    q: 'What is the Truth Engine and why does it prevent AI hallucinations?',
    a: 'The Truth Engine extracts and locks verified facts from your master resume and confirmed claims. When tailoring a resume or generating screening answers, the AI is restricted from inventing skills, titles, or metrics you have not confirmed.',
  },
  {
    q: 'Which Applicant Tracking Systems (ATS) are supported?',
    a: 'Progeni includes native Chrome Manifest V3 adapters for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, and Taleo, plus job detection on LinkedIn, Indeed, and company career portals.',
  },
  {
    q: 'How does the deterministic matching engine work?',
    a: 'Instead of generic LLM guesswork, Progeni scores candidates across six transparent dimensions: technical skills alignment (30%), experience duration (20%), seniority match (15%), location and visa eligibility (15%), workplace mode (10%), and compensation compatibility (10%).',
  },
  {
    q: 'What is the Progeni AI interview simulator?',
    a: 'The simulator integrates role-specific technical and behavioral mock interview drills directly into your application pipeline, helping you practice real questions tailored to the company and job description.',
  },
  {
    q: 'Can I start for free without entering a credit card?',
    a: 'Yes. The Starter tier is free forever and includes master resume parsing, ATS diagnostics, Chrome extension integration, and 15 job match analyses per month.',
  },
];

const features = [
  {
    title: 'Deterministic scoring',
    body: 'Every job is evaluated against your real profile across six weighted dimensions, with a plain-language explanation you can audit.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
    ),
  },
  {
    title: 'Truth Engine grounding',
    body: 'Resumes and answers are linked to verified records, so nothing you cannot defend in an interview makes it into an application.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.002A11.96 11.96 0 0112 2.714z"
      />
    ),
  },
  {
    title: 'Chrome extension (MV3)',
    body: 'Detects job descriptions on major boards and career portals, then fills application fields only after you click Detect.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z"
      />
    ),
  },
  {
    title: 'Interview simulation',
    body: 'Run technical and behavioral drills built from the requirements of the exact role you are targeting.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M8.25 6.75h7.5m-7.5 4.5h4.5m-9.75 6l2.25-2.25H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v9a2.25 2.25 0 002.25 2.25h.75z"
      />
    ),
  },
  {
    title: 'Application tracker',
    body: 'Track every opportunity through discovered, preparing, approved, submitted, shortlisted, and interview stages with an audit trail.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M9 12h6m-6 4h6m2.25 5.25H6.75A2.25 2.25 0 014.5 19V5.25A2.25 2.25 0 016.75 3h6.879a2.25 2.25 0 011.59.659l3.122 3.122a2.25 2.25 0 01.659 1.59V19a2.25 2.25 0 01-2.25 2.25z"
      />
    ),
  },
  {
    title: 'Your data stays yours',
    body: 'Workspace records are private to your account. We never resell candidate data to recruiters or ad networks, and you can wipe it anytime.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    ),
  },
];

const atsPartners = ['Greenhouse', 'Lever', 'Ashby', 'Workday', 'SmartRecruiters', 'LinkedIn Jobs', 'Indeed'];

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (!usesCloudAuthentication) return;
    try {
      const client = getSupabaseClient();
      if (!client) return;
      void client.auth.getSession().then(({ data }) => {
        if (data?.session) setIsAuthenticated(true);
      });
    } catch {
      // Unauthenticated fallback.
    }
  }, []);

  function openAuth(mode: 'sign-in' | 'sign-up') {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface antialiased">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
              P
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                PROGENI <span className="text-primary">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                Career agent
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-on-surface-variant md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-on-surface">
              How it works
            </a>
            <a href="#features" className="transition-colors hover:text-on-surface">
              Features
            </a>
            <a href="#integrations" className="transition-colors hover:text-on-surface">
              ATS ecosystem
            </a>
            <a href="#pricing" className="transition-colors hover:text-on-surface">
              Pricing
            </a>
            <a href="#faq" className="transition-colors hover:text-on-surface">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle size="sm" />
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('sign-in')}
                  className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface sm:inline-flex"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('sign-up')}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-outline-variant">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[11px] font-medium text-on-surface-variant">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Deterministic matching
              <span className="text-outline">•</span>
              Human approval on every submission
            </div>

            <h1 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl">
              Apply to more roles in less time — without fighting ATS filters.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
              Progeni matches real job requirements against your verified history, tailors
              evidence-grounded resumes, and autofills applications with your explicit approval.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:shadow-indigo-600/40 active:scale-[0.99] sm:w-auto"
              >
                Get started free
                <span aria-hidden>→</span>
              </button>
              <a
                href="#how-it-works"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-outline bg-surface px-6 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-variant sm:w-auto"
              >
                See how it works
              </a>
            </div>

            <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
              <span>Free starter tier</span>
              <span aria-hidden>•</span>
              <span>No credit card</span>
              <span aria-hidden>•</span>
              <span>Nothing submitted without review</span>
            </p>
          </div>

          {/* Product preview */}
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="rounded-2xl border border-outline-variant bg-surface p-5 shadow-soft sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                  <span className="ml-2 font-mono text-[11px] text-on-surface-variant">
                    progeni-workspace
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-container px-2.5 py-1 text-[10px] font-semibold text-on-success-container">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  ATS match 96%
                </span>
              </div>

              <div className="grid items-center gap-6 md:grid-cols-12">
                <div className="space-y-4 md:col-span-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-sm font-semibold text-on-primary-container">
                      SE
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">Staff Software Engineer</h2>
                      <p className="text-[11px] text-on-surface-variant">
                        Stripe · San Francisco, CA (Hybrid) · $210k – $250k
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-on-surface-variant">Technical skills</span>
                        <span className="font-semibold text-success">96%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                        <div className="h-full w-[96%] rounded-full bg-success" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-on-surface-variant">Experience & seniority</span>
                        <span className="font-semibold text-success">100%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                        <div className="h-full w-full rounded-full bg-success" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-outline-variant bg-surface-subtle p-3 text-[11px] leading-relaxed">
                    <span className="mt-0.5 text-success">✓</span>
                    <div>
                      <span className="block font-semibold">Grounded in your records</span>
                      <span className="text-on-surface-variant">
                        14 bullet points verified · 0 fabricated claims
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 rounded-xl border border-outline-variant bg-surface-subtle p-4 md:col-span-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                    Application assistant
                  </span>
                  {[
                    ['ATS optimized resume', 'Ready'],
                    ['Grounded cover letter', 'Generated'],
                    ['Greenhouse autofill', 'Mapped 12/12'],
                  ].map(([label, status]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface px-3 py-2 text-[11px]"
                    >
                      <span>{label}</span>
                      <span className="font-medium text-success">{status}</span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => openAuth('sign-up')}
                    className="mt-1 w-full rounded-lg bg-primary py-2 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Try it with your resume
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-outline-variant bg-surface-subtle/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4 lg:px-8">
          {[
            ['12,400+', 'Applications tailored'],
            ['98.4%', 'ATS parser compatibility'],
            ['4.8×', 'Faster callback velocity'],
            ['0%', 'Fabricated qualifications'],
          ].map(([value, label]) => (
            <div key={label}>
              <div className="text-2xl font-bold tracking-tight sm:text-3xl">{value}</div>
              <div className="mt-1 text-[11px] text-on-surface-variant">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Three steps
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            From job discovery to a verified application
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['01', 'Upload your master resume', 'Add your profile in PDF, DOCX, or plain text. The Truth Engine extracts verified skills, roles, and achievements.'],
            ['02', 'Review deterministic matches', 'Jobs are scored across six dimensions with transparent explanations and skill-gap alerts — no hallucinated fit.'],
            ['03', 'Review, approve, autofill', 'Inspect the tailored resume and generated answers. The extension maps ATS fields and fills them only with your approval.'],
          ].map(([step, title, body]) => (
            <div key={step} className="rounded-2xl border border-outline-variant bg-surface p-6">
              <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-primary-container px-2 text-xs font-semibold text-on-primary-container">
                {step}
              </span>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-on-surface-variant">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-outline-variant bg-surface-subtle/50 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Platform
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Built for candidates who want control and clarity
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-outline-variant bg-surface p-6 transition-colors hover:border-outline"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {feature.icon}
                  </svg>
                </span>
                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-on-surface-variant">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ATS ecosystem */}
      <section id="integrations" className="border-b border-outline-variant">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-on-surface-variant">
            Works across the modern recruitment ecosystem
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {atsPartners.map((partner) => (
              <span key={partner} className="text-sm font-semibold text-on-surface-variant/80">
                {partner}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Pricing
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Start free, upgrade when you need volume
            </h2>

            <div className="mt-6 inline-flex items-center rounded-xl border border-outline-variant bg-surface p-1">
              {(['monthly', 'yearly'] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    billingCycle === cycle
                      ? 'bg-primary text-primary-foreground'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                  {cycle === 'yearly' && (
                    <span className="rounded bg-success-container px-1.5 py-0.5 text-[9px] font-bold text-on-success-container">
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {/* Starter */}
            <div className="flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface p-6">
              <div>
                <h3 className="text-base font-semibold">Starter</h3>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Essential tools to launch your search.
                </p>
                <div className="mt-5 text-2xl font-bold">
                  $0 <span className="text-[11px] font-medium text-on-surface-variant">forever</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-[12px] text-on-surface-variant">
                  {[
                    '15 AI job match analyses / month',
                    'Truth Engine master profile',
                    'ATS keyword gap diagnostics',
                    'Chrome extension form detection',
                    'Application tracker',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-6 w-full rounded-xl border border-outline bg-surface-subtle py-2.5 text-xs font-semibold transition-colors hover:bg-surface-variant"
              >
                Start free
              </button>
            </div>

            {/* Professional */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-primary bg-surface p-6 shadow-card">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                Most popular
              </span>
              <div>
                <h3 className="text-base font-semibold">Professional</h3>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  For active candidates targeting fast offers.
                </p>
                <div className="mt-5 text-2xl font-bold">
                  {billingCycle === 'monthly' ? '$19' : '$15'}{' '}
                  <span className="text-[11px] font-medium text-on-surface-variant">/ month</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-[12px]">
                  {[
                    'Unlimited AI job match scoring',
                    '30 tailored resumes & PDF exports',
                    'Interview simulation drills',
                    'One-click multi-ATS autofill',
                    'Priority support queue',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-6 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Get started with Pro
              </button>
            </div>

            {/* Executive */}
            <div className="flex flex-col justify-between rounded-2xl border border-outline-variant bg-surface p-6">
              <div>
                <h3 className="text-base font-semibold">Executive</h3>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Maximum power for senior, high-volume searches.
                </p>
                <div className="mt-5 text-2xl font-bold">
                  {billingCycle === 'monthly' ? '$39' : '$31'}{' '}
                  <span className="text-[11px] font-medium text-on-surface-variant">/ month</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-[12px] text-on-surface-variant">
                  {[
                    'Everything in Professional',
                    'Unlimited tailored resumes & portfolios',
                    'Advanced technical mock drills',
                    'Multi-persona resume studio',
                    'Fast-track priority channel',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-success">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-6 w-full rounded-xl border border-outline bg-surface-subtle py-2.5 text-xs font-semibold transition-colors hover:bg-surface-variant"
              >
                Choose Executive
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-outline-variant bg-surface-subtle/40 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Questions, answered
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqs.map((faq, index) => {
              const open = activeFaq === index;
              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-xl border border-outline-variant bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(open ? null : index)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[13px] font-medium"
                  >
                    <span>{faq.q}</span>
                    <span
                      aria-hidden
                      className={`text-lg leading-none text-on-surface-variant transition-transform ${
                        open ? 'rotate-45' : ''
                      }`}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="border-t border-outline-variant px-5 py-4 text-[12px] leading-relaxed text-on-surface-variant">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-outline-variant bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Stop filling endless forms manually
          </h2>
          <p className="mt-3 text-sm text-indigo-100/80">
            Take control of your applications with deterministic accuracy. Join thousands of
            candidates landing more interviews.
          </p>
          <button
            type="button"
            onClick={() => openAuth('sign-up')}
            className="mt-7 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Create your free account
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant py-8 text-[11px] text-on-surface-variant">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className="font-semibold text-on-surface">Progeni AutoApply</span>
            <span aria-hidden>·</span>
            <span>© {new Date().getFullYear()} Progeni Inc.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-on-surface">
              Privacy
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-on-surface">
              Terms
            </Link>
            <span className="inline-flex items-center gap-1.5 text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              All systems operational
            </span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        nextPath="/dashboard"
      />
    </div>
  );
}
