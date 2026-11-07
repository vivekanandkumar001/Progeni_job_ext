'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Chrome,
  CircleDot,
  ClipboardCheck,
  FileSearch,
  Fingerprint,
  Gauge,
  Layers,
  Lock,
  ScanText,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import AuthModal from '../components/AuthModal';
import LandingHeader from '../components/LandingHeader';
import ThemeToggle from '../components/ThemeToggle';
import { getSupabaseClient, usesCloudAuthentication } from '../lib/api';

const atsPartners = ['Greenhouse', 'Lever', 'Ashby', 'Workday', 'SmartRecruiters', 'LinkedIn', 'Indeed'];

const features = [
  {
    title: 'Deterministic scoring',
    body: 'Every job is evaluated against your real profile across six weighted dimensions, with a plain-language explanation you can audit.',
    icon: Gauge,
  },
  {
    title: 'Truth Engine grounding',
    body: 'Resumes and answers stay linked to verified records, so nothing you cannot defend in an interview reaches an application.',
    icon: ShieldCheck,
  },
  {
    title: 'Chrome extension (MV3)',
    body: 'Detects job descriptions on major boards and career portals, then prepares fields only after you click Detect.',
    icon: Chrome,
  },
  {
    title: 'ATS resume studio',
    body: 'Build targeted, parser-safe resumes from your master profile without inventing experience or metrics.',
    icon: FileSearch,
  },
  {
    title: 'Pipeline tracking',
    body: 'Move every opportunity from discovered to interview with a clean audit trail and follow-up reminders.',
    icon: Layers,
  },
  {
    title: 'Private by default',
    body: 'Workspace records stay tied to your account. No recruiter resale, no ad networks, and you can wipe your data anytime.',
    icon: Lock,
  },
];

const plans = [
  {
    name: 'Starter',
    tagline: 'For a focused, honest search.',
    monthly: 0,
    yearly: 0,
    cta: 'Start free',
    highlight: false,
    features: ['Master resume parsing', 'ATS diagnostics', 'Chrome extension', '15 match analyses / month'],
  },
  {
    name: 'Pro',
    tagline: 'For candidates applying seriously.',
    monthly: 12,
    yearly: 108,
    cta: 'Go Pro',
    highlight: true,
    features: [
      'Unlimited match analyses',
      'Targeted resume studio',
      'Truth Engine guardrails',
      'Application tracker & follow-ups',
      'Interview preparation drills',
    ],
  },
  {
    name: 'Teams',
    tagline: 'For career coaches and bootcamps.',
    monthly: 39,
    yearly: 348,
    cta: 'Talk to us',
    highlight: false,
    features: ['Everything in Pro', 'Shared candidate workspace', 'Cohort analytics', 'Priority support'],
  },
];

const faqs = [
  {
    q: 'Does Progeni submit applications automatically without my review?',
    a: 'Never. Progeni operates with a strict human-in-the-loop guarantee. It matches jobs, generates targeted ATS resumes, and prepares screening answers, but requires your explicit approval before any form is submitted.',
  },
  {
    q: 'What is the Truth Engine and why does it prevent AI hallucinations?',
    a: 'The Truth Engine extracts and locks verified facts from your master resume and confirmed claims. When tailoring a resume or generating screening answers, the AI is restricted from inventing skills, titles, or metrics you have not confirmed.',
  },
  {
    q: 'Which applicant tracking systems are supported?',
    a: 'Progeni includes native Chrome Manifest V3 adapters for Greenhouse, Lever, Ashby, Workday, and SmartRecruiters, plus job detection on LinkedIn, Indeed, and company career portals.',
  },
  {
    q: 'How does the matching engine work?',
    a: 'Instead of generic LLM guesswork, Progeni scores candidates across transparent dimensions such as skills alignment, experience duration, seniority, location eligibility, workplace mode, and compensation compatibility. Missing information is shown as unknown, not assumed.',
  },
  {
    q: 'Can I start for free without entering a credit card?',
    a: 'Yes. The Starter tier is free forever and includes master resume parsing, ATS diagnostics, Chrome extension integration, and 15 job match analyses per month.',
  },
];

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

  function primaryAction() {
    if (isAuthenticated) {
      window.location.href = '/dashboard';
      return;
    }
    openAuth('sign-up');
  }

  return (
    <div className="page-canvas flex min-h-screen flex-col bg-background text-on-surface antialiased">
      {/* ============================== REDESIGNED HEADER ============================== */}
      <LandingHeader
        isAuthenticated={isAuthenticated}
        openAuth={openAuth}
        primaryAction={primaryAction}
      />

      <main className="flex-1">
        {/* ============================== HERO ============================== */}
        <section className="relative overflow-hidden border-b border-outline-variant">
          <div className="pointer-events-none absolute left-1/2 top-[-16rem] h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[130px]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[10.5px] font-semibold text-on-surface-variant shadow-sm">
                <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
                Human-in-the-loop · Never auto-submits
              </div>
              <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight sm:text-[46px] lg:text-[54px]">
                Apply smarter,
                <span className="block text-gradient">not blindly.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[14px] leading-relaxed text-on-surface-variant sm:text-[15px]">
                Progeni turns your real experience into explainable job matches, parser-safe resumes,
                and interview-ready answers — with every claim grounded in what you can defend.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={primaryAction}
                  className="button button-primary h-12 px-6 text-sm"
                >
                  {isAuthenticated ? 'Open your workspace' : 'Start free — no card'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#how-it-works" className="button button-secondary h-12 px-6 text-sm">
                  See how it works
                </a>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-on-surface-variant">
                {['Evidence-based match scores', 'No fabricated skills', 'Wipe data anytime'].map((item) => (
                  <span className="inline-flex items-center gap-1.5" key={item}>
                    <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Product preview */}
            <div id="extension" className="relative scroll-mt-28">
              <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-outline-variant bg-surface shadow-card">
                <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                  </div>
                  <span className="font-mono text-[10px] text-on-surface-variant">progeni / match</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-container px-2 py-0.5 text-[9px] font-bold text-on-success-container">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    LIVE
                  </span>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-[13px] font-bold text-on-primary-container">
                      SE
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">Staff Software Engineer</p>
                      <p className="text-[11px] text-on-surface-variant">Remote · Full-time · Posted 2d ago</p>
                    </div>
                    <span className="ml-auto rounded-full border border-success/25 bg-success-container px-2.5 py-1 text-[10px] font-bold text-on-success-container">
                      96% fit
                    </span>
                  </div>
                  <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-subtle p-3.5">
                    {[
                      ['Technical skills', 96, 'bg-success'],
                      ['Experience & seniority', 100, 'bg-success'],
                      ['Location eligibility', 88, 'bg-info'],
                      ['Compensation overlap', 70, 'bg-warning'],
                    ].map(([label, value, tone]) => (
                      <div key={label as string}>
                        <div className="mb-1 flex items-center justify-between text-[10.5px]">
                          <span className="text-on-surface-variant">{label}</span>
                          <span className="font-semibold text-on-surface">{value}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
                          <div
                            className={`h-full rounded-full ${tone}`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="text-[10.5px] leading-relaxed text-on-surface-variant">
                      <strong className="font-semibold text-on-surface">Why this fits:</strong> 6 of 7
                      required skills are confirmed on your profile. One gap flagged for review — no
                      assumptions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Partner strip */}
          <div id="integrations" className="border-t border-outline-variant bg-surface/60 scroll-mt-28">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-5 sm:px-6 lg:px-8">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                Works with
              </span>
              {atsPartners.map((partner) => (
                <span key={partner} className="text-[12px] font-semibold text-on-surface-variant/75">
                  {partner}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== HOW IT WORKS ============================== */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20 scroll-mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">How it works</span>
            <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">
              Three steps. Total control.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              Everything starts from your confirmed profile. You review each step before anything leaves
              your workspace.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Build your truth base',
                body: 'Upload a resume or enter your profile. Confirm every skill, role, and claim so the rest of the system stays grounded.',
                icon: Fingerprint,
              },
              {
                step: '02',
                title: 'Detect & understand fit',
                body: 'Use the Chrome extension or paste a job. Get an explainable score with matched evidence, gaps, and unknowns.',
                icon: ScanText,
              },
              {
                step: '03',
                title: 'Prepare & apply intentionally',
                body: 'Tailor your resume, prepare answers, and track the pipeline. Progeni prepares; you decide and submit.',
                icon: ClipboardCheck,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.step}
                  className="card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-card"
                >
                  <span className="absolute right-4 top-3 text-[40px] font-extrabold leading-none text-on-surface/[0.04]">
                    {item.step}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-primary">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <h3 className="mt-4 text-[14px] font-bold tracking-tight">{item.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-on-surface-variant">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ============================== FEATURES ============================== */}
        <section id="features" className="border-y border-outline-variant bg-surface-subtle/40 scroll-mt-28">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div className="max-w-xl">
                <span className="eyebrow">The workspace</span>
                <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">
                  A career cockpit, not a slot machine.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  Purpose-built modules that keep the process honest, visible, and repeatable.
                </p>
              </div>
              <span className="chip shrink-0">
                <CircleDot className="h-3 w-3 text-success" />
                Deterministic, not generative guesswork
              </span>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant text-on-surface-variant transition-colors group-hover:bg-primary-container group-hover:text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.9} />
                    </span>
                    <h3 className="mt-3.5 text-[13.5px] font-bold tracking-tight">{feature.title}</h3>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-on-surface-variant">{feature.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================== TRUTH ENGINE ============================== */}
        <section id="truth-engine" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20 scroll-mt-28">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="eyebrow">Truth Engine</span>
              <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">
                If you cannot defend it, it does not get written.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                Generic AI tools optimise for convincing text. Progeni optimises for surviving the
                interview. Every generated line is traceable to a fact you confirmed.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  ['Verified facts only', 'Skills, titles, dates, and metrics are locked from your master profile.'],
                  ['Visible evidence', 'Every match and claim links back to the exact snippet that supports it.'],
                  ['Review before sending', 'Nothing is submitted, copied, or sent without an explicit action.'],
                ].map(([title, body]) => (
                  <li className="flex items-start gap-3" key={title}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-container text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="text-[12.5px] leading-relaxed text-on-surface-variant">
                      <strong className="font-semibold text-on-surface">{title}.</strong> {body}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
                <span className="flex items-center gap-2 text-[11px] font-semibold text-on-surface">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  Claim verification
                </span>
                <span className="rounded-full bg-success-container px-2 py-0.5 text-[9px] font-bold text-on-success-container">
                  GROUNDED
                </span>
              </div>
              <div className="space-y-3 p-4">
                {[
                  ['Led migration to event-driven billing', 'Confirmed · Resume v3'],
                  ['Mentored 6 engineers across 2 teams', 'Confirmed · Profile'],
                  ['Reduced p95 latency by 42%', 'Evidence linked · Metric'],
                  ['Built Kubernetes platform from scratch', 'Needs review · Unverified'],
                ].map(([claim, meta], index) => (
                  <div
                    key={claim}
                    className="flex items-start gap-2.5 rounded-xl border border-outline-variant bg-surface-subtle p-3"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        index === 3
                          ? 'bg-warning-container text-on-warning-container'
                          : 'bg-success-container text-success'
                      }`}
                    >
                      {index === 3 ? '!' : <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium text-on-surface">{claim}</p>
                      <p className="text-[10px] text-on-surface-variant">{meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================== PRICING ============================== */}
        <section id="pricing" className="border-y border-outline-variant bg-surface-subtle/40 scroll-mt-28">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Pricing</span>
              <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">
                Start free. Upgrade when it pays for itself.
              </h2>
              <div className="mt-6 inline-flex items-center rounded-xl border border-outline-variant bg-surface p-1">
                {(['monthly', 'yearly'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-lg px-4 py-1.5 text-[11.5px] font-semibold capitalize transition-colors ${
                      billingCycle === cycle
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {cycle}
                    {cycle === 'yearly' && <span className="ml-1 text-[9px] opacity-80">−25%</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`card relative flex flex-col p-6 ${
                    plan.highlight
                      ? 'border-primary/40 shadow-card ring-1 ring-primary/15'
                      : ''
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-[9.5px] font-bold uppercase tracking-wider text-white shadow-sm">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-[15px] font-bold tracking-tight">{plan.name}</h3>
                  <p className="mt-1 text-[11.5px] text-on-surface-variant">{plan.tagline}</p>
                  <div className="mt-5 flex items-end gap-1.5">
                    <span className="text-[34px] font-extrabold leading-none tracking-tight">
                      ${billingCycle === 'monthly' ? plan.monthly : plan.yearly}
                    </span>
                    <span className="pb-1 text-[11px] text-on-surface-variant">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li className="flex items-start gap-2 text-[12px] text-on-surface-variant" key={feature}>
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={plan.monthly === 0 ? primaryAction : () => openAuth('sign-up')}
                    className={`button mt-6 w-full ${
                      plan.highlight ? 'button-primary' : 'button-secondary'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================== FAQ ============================== */}
        <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20 scroll-mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">FAQ</span>
            <h2 className="text-[28px] font-extrabold tracking-tight sm:text-[34px]">
              Straight answers, no fine print.
            </h2>
          </div>
          <div className="mt-8 space-y-2.5">
            {faqs.map((faq, index) => {
              const open = activeFaq === index;
              return (
                <div
                  key={faq.q}
                  className={`card overflow-hidden transition-colors ${open ? 'border-primary/30' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(open ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={open}
                  >
                    <span className="text-[13px] font-semibold text-on-surface">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform ${
                        open ? 'rotate-180 text-primary' : ''
                      }`}
                    />
                  </button>
                  {open && (
                    <p className="border-t border-outline-variant bg-surface-subtle/60 px-5 py-4 text-[12.5px] leading-relaxed text-on-surface-variant">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================== CTA ============================== */}
        <section id="get-started" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8 scroll-mt-28">
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary-container via-surface to-secondary-container/40 px-6 py-12 text-center sm:px-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-secondary/15 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                <Zap className="h-3 w-3 text-primary" />
                Free forever starter tier
              </span>
              <h2 className="mx-auto mt-4 max-w-2xl text-[28px] font-extrabold tracking-tight sm:text-[36px]">
                Build a search you can actually defend.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-on-surface-variant">
                Join candidates who would rather send fewer, stronger applications — backed by
                evidence instead of keywords.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button type="button" onClick={primaryAction} className="button button-primary h-12 px-6 text-sm">
                  {isAuthenticated ? 'Open your workspace' : 'Create free workspace'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('sign-in')}
                  className="button button-secondary h-12 px-6 text-sm"
                >
                  I already have an account
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-outline-variant bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-xs font-extrabold text-white">
                  P
                </span>
                <span className="text-[12px] font-bold tracking-tight">
                  PROGENI <span className="text-primary">AUTOAPPLY</span>
                </span>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-on-surface-variant">
                Career intelligence for candidates who value honesty, clarity, and control. Not
                affiliated with any job board or employer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[11.5px] sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Product</p>
                <a href="#features" className="block text-on-surface-variant hover:text-on-surface">Features</a>
                <a href="#pricing" className="block text-on-surface-variant hover:text-on-surface">Pricing</a>
                <a href="#integrations" className="block text-on-surface-variant hover:text-on-surface">Integrations</a>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Workspace</p>
                <Link href="/dashboard" className="block text-on-surface-variant hover:text-on-surface">Overview</Link>
                <Link href="/candidate-profile" className="block text-on-surface-variant hover:text-on-surface">Career profile</Link>
                <Link href="/application-tracker" className="block text-on-surface-variant hover:text-on-surface">Tracker</Link>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Trust</p>
                <Link href="/privacy" className="block text-on-surface-variant hover:text-on-surface">Privacy</Link>
                <Link href="/settings-privacy" className="block text-on-surface-variant hover:text-on-surface">Data controls</Link>
                <button
                  type="button"
                  onClick={() => openAuth('sign-in')}
                  className="block text-left text-on-surface-variant hover:text-on-surface"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-outline-variant pt-5 text-[10.5px] text-on-surface-variant sm:flex-row">
            <span>© {new Date().getFullYear()} Progeni AutoApply. All rights reserved.</span>
            <span className="inline-flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3" />
              Deterministic matching · human review · no auto-submit
            </span>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
