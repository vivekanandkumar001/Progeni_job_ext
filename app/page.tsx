'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthModal from '../components/AuthModal';
import { getSupabaseClient, usesCloudAuthentication } from '../lib/api';

export default function LandingPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (usesCloudAuthentication) {
      try {
        const client = getSupabaseClient();
        if (client) {
          void client.auth.getSession().then(({ data }) => {
            if (data?.session) {
              setIsAuthenticated(true);
            }
          });
        }
      } catch {
        // Fallback or unauthenticated
      }
    }
  }, []);

  function openAuth(mode: 'sign-in' | 'sign-up') {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }

  const faqs = [
    {
      q: 'Does Progeni submit applications automatically without my review?',
      a: 'Never. Progeni operates with a strict Human-In-The-Loop guarantee. The AI matches jobs, generates targeted ATS resumes, and autofills screening questions, but requires your explicit digital approval before any form is submitted.',
    },
    {
      q: 'What is the Truth Engine and why does it prevent AI hallucinations?',
      a: 'The Truth Engine extracts and locks verified facts from your master resume and confirmed claims. When tailoring a resume or generating screening answers, the AI is cryptographically restricted from inventing skills, titles, or metrics that you have not confirmed.',
    },
    {
      q: 'Which Applicant Tracking Systems (ATS) are supported?',
      a: 'Progeni includes native Chrome Manifest V3 adapters for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, Taleo, as well as job detection on LinkedIn, Indeed, and company career portals.',
    },
    {
      q: 'How does the Deterministic Matching Engine work?',
      a: 'Unlike generic LLM guess-work, Progeni scores candidates across 6 deterministic dimensions: technical skills alignment (30%), experience duration (20%), seniority match (15%), location/visa eligibility (15%), workplace mode (10%), and compensation compatibility (10%).',
    },
    {
      q: 'What is the Progeni AI Interview Simulator?',
      a: 'The simulator integrates role-specific technical and behavioral mock interview drills directly into your application pipeline, helping you practice real questions tailored to the company and job description.',
    },
    {
      q: 'Can I start for free without entering a credit card?',
      a: 'Yes! The Starter tier is 100% free forever, includes master resume parsing, ATS diagnostics, Chrome extension integration, and 15 job match analyses per month.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* 1. STICKY MODERN NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <span className="text-white font-black text-xl tracking-wider">P</span>
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-tight block">
                PROGENI <span className="text-indigo-400 font-extrabold">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                Autonomous Career Agent
              </span>
            </div>
          </Link>

          {/* Navigation Anchor Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#integrations" className="hover:text-white transition-colors">ATS Ecosystem</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 flex items-center gap-2"
              >
                <span>Go to Dashboard</span>
                <span>→</span>
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('sign-in')}
                  className="py-2 px-4 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('sign-up')}
                  className="py-2 px-4 sm:px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all duration-200 active:scale-[0.99]"
                >
                  Get Started Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-pink-500/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs sm:text-sm font-medium mb-8 backdrop-blur-md shadow-lg shadow-indigo-950/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Next-Gen Career Automation 2.0</span>
              <span className="text-indigo-500">•</span>
              <span className="text-slate-300">100% Deterministic ATS Matching</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.12] mb-6">
              Apply to 50+ Top Tech Jobs in Minutes —{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
                Without ATS Filters.
              </span>
            </h1>

            {/* Subcopy */}
            <p className="text-base sm:text-xl text-slate-300 leading-relaxed mb-10 max-w-2xl mx-auto">
              Progeni&apos;s intelligent career assistant matches real job requirements against your verified history,
              tailors evidence-grounded resumes, and autofills ATS applications with strict human approval.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="w-full sm:w-auto py-4 px-8 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base shadow-xl shadow-indigo-600/35 hover:shadow-indigo-600/50 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-3"
              >
                <span>Get Started Free — Fast Setup</span>
                <span>🚀</span>
              </button>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-base transition-colors flex items-center justify-center gap-2"
              >
                <span>Explore Live Flow</span>
                <span>↓</span>
              </a>
            </div>

            {/* Micro-guarantee */}
            <p className="text-xs text-slate-400 flex items-center justify-center gap-4 flex-wrap">
              <span>✓ Free starter tier</span>
              <span>•</span>
              <span>✓ No credit card required</span>
              <span>•</span>
              <span>✓ Zero automated submissions without review</span>
            </p>
          </div>

          {/* Interactive Hero Showcase Preview Card */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-2xl shadow-indigo-950/50 backdrop-blur-xl">
              {/* Fake Window Header */}
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs text-slate-500 ml-2 font-mono">progeni-workspace.v2</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  ATS Match: 96% (Exceptional)
                </div>
              </div>

              {/* Showcase Content Grid */}
              <div className="grid md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl">
                      💼
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Staff Software Engineer</h3>
                      <p className="text-xs text-slate-400">Stripe • San Francisco, CA (Hybrid) • $210,000 - $250,000</p>
                    </div>
                  </div>

                  {/* Grounded Dimensions */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">Technical Skills Alignment</span>
                      <span className="text-emerald-400 font-bold">96% (TypeScript, React, Next.js, Distributed Systems)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full w-[96%]" />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-300">Experience & Seniority</span>
                      <span className="text-emerald-400 font-bold">100% (7+ Years Required • 8 Years Grounded)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full w-[100%]" />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5">
                    <span className="text-indigo-400 text-base">🛡️</span>
                    <div>
                      <span className="font-semibold text-white block">Truth Engine Grounding</span>
                      14 bullet points verified from Master Profile. 0 fabricated claims.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col gap-3 p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Application Assistant
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-slate-200">ATS Optimized Resume</span>
                    <span className="text-emerald-400 font-semibold">Ready</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-slate-200">Grounded Cover Letter</span>
                    <span className="text-emerald-400 font-semibold">Generated</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-slate-200">Greenhouse Form Autofill</span>
                    <span className="text-indigo-400 font-semibold">Mapped (12/12)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAuth('sign-up')}
                    className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-600/30"
                  >
                    Try Workspace With Your Resume →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PERFORMANCE STATS STRIP */}
      <section className="py-12 border-y border-slate-800 bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-black text-white mb-1">12,400+</div>
              <div className="text-xs sm:text-sm text-slate-400 font-medium">Applications Tailored</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-indigo-400 mb-1">98.4%</div>
              <div className="text-xs sm:text-sm text-slate-400 font-medium">ATS Parser Compatibility</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-purple-400 mb-1">4.8×</div>
              <div className="text-xs sm:text-sm text-slate-400 font-medium">Faster Callback Velocity</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 mb-1">0%</div>
              <div className="text-xs sm:text-sm text-slate-400 font-medium">Fabricated Qualifications</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 mb-3">Simple 3-Step Flow</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            From job discovery to verified application in seconds
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 relative">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 font-black text-xl flex items-center justify-center mb-6">
              01
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Upload Master Resume</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Upload your career profile in PDF, DOCX, or text. The Truth Engine extracts verified skills, roles, and achievements.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 relative">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 font-black text-xl flex items-center justify-center mb-6">
              02
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Deterministic AI Matching</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Jobs are scored across 6 distinct dimensions without hallucination. View transparent match explanations and skill gap alerts.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 font-black text-xl flex items-center justify-center mb-6">
              03
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Review &amp; 1-Click Autofill</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Review your tailored resume and generated answers. The Chrome extension maps and autofills ATS fields with your digital approval.
            </p>
          </div>
        </div>
      </section>

      {/* 5. BENTO GRID FEATURES */}
      <section id="features" className="py-20 lg:py-28 bg-slate-900/50 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 mb-3">
              Full-Stack Platform Capabilities
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered for candidates who demand truth, control, and results
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-lg font-bold text-white mb-2">Deterministic Scoring Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Evaluates job postings against your real profile across 6 distinct weights: Skills (30%), Experience (20%), Seniority (15%), Location (15%), Workplace Mode (10%), and Salary (10%).
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">🛡️</div>
              <h3 className="text-lg font-bold text-white mb-2">Truth Engine &amp; Zero Hallucination</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prevents generative AI from fabricating qualifications or making claims you cannot defend in an interview. Every bullet point links to verified experience.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-lg font-bold text-white mb-2">Native Chrome Extension (MV3)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically detects job descriptions on Greenhouse, Lever, Ashby, Workday, LinkedIn, and Indeed. Fills application fields only when you click Detect.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="text-lg font-bold text-white mb-2">Progeni Interview Simulation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Seamlessly launch interactive technical and behavioral interview simulation sessions based on your actual target job requirements.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-lg font-bold text-white mb-2">Application &amp; Timeline Tracker</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tracks applications through 14 distinct stages: discovered, preparing, approved, submitted, shortlisted, and interview scheduled with immutable audit logs.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className="text-3xl mb-4">🔒</div>
              <h3 className="text-lg font-bold text-white mb-2">Candidate Data Sovereignty</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your data is stored in your private workspace. We never resell candidate records to recruiters or third-party ad networks. You can wipe data at any time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SUPPORTED ATS ECOSYSTEM */}
      <section id="integrations" className="py-16 border-t border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-8">
            Works natively across the modern recruitment ecosystem
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-80">
            <span className="text-base font-bold tracking-wider text-slate-300">Greenhouse</span>
            <span className="text-base font-bold tracking-wider text-slate-300">Lever</span>
            <span className="text-base font-bold tracking-wider text-slate-300">Ashby</span>
            <span className="text-base font-bold tracking-wider text-slate-300">Workday</span>
            <span className="text-base font-bold tracking-wider text-slate-300">SmartRecruiters</span>
            <span className="text-base font-bold tracking-wider text-slate-300">LinkedIn Jobs</span>
            <span className="text-base font-bold tracking-wider text-slate-300">Indeed</span>
          </div>
        </div>
      </section>

      {/* 7. TRANSPARENT PRICING */}
      <section id="pricing" className="py-20 lg:py-28 border-t border-slate-800 bg-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 mb-3">Simple Pricing</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-6">
              Invest in your career growth with zero lock-in
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                  billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  billingCycle === 'yearly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Annual Billing</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Starter */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Starter</h3>
                <p className="text-xs text-slate-400 mb-4">Essential tools to launch your job search.</p>
                <div className="text-3xl font-black text-white mb-6">
                  $0 <span className="text-xs font-medium text-slate-400">/ forever</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ 15 AI Job Match Analyses / month</li>
                  <li className="flex items-center gap-2">✓ Truth Engine Master Profile</li>
                  <li className="flex items-center gap-2">✓ ATS Keyword Gap Diagnostics</li>
                  <li className="flex items-center gap-2">✓ Chrome Extension Form Detection</li>
                  <li className="flex items-center gap-2">✓ Kanban Application Tracker</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Start Free Forever
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-950/80 to-slate-900 border-2 border-indigo-500 flex flex-col justify-between relative shadow-2xl shadow-indigo-950/60">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-extrabold uppercase tracking-wider">
                Most Popular
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Professional</h3>
                <p className="text-xs text-indigo-300 mb-4">For active candidates targeting fast offers.</p>
                <div className="text-3xl font-black text-white mb-6">
                  {billingCycle === 'monthly' ? '$19' : '$15'}{' '}
                  <span className="text-xs font-medium text-slate-400">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-200">
                  <li className="flex items-center gap-2">✓ <strong>Unlimited</strong> AI Job Match Scoring</li>
                  <li className="flex items-center gap-2">✓ <strong>30 Tailored Resumes</strong> &amp; PDF Exports</li>
                  <li className="flex items-center gap-2">✓ <strong>Progeni Interview Simulation</strong> Drills</li>
                  <li className="flex items-center gap-2">✓ 1-Click Multi-ATS Smart Autofill</li>
                  <li className="flex items-center gap-2">✓ Priority Support Queue</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-8 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow-lg shadow-indigo-600/30"
              >
                Get Started with Pro
              </button>
            </div>

            {/* Premium Plan */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Executive</h3>
                <p className="text-xs text-slate-400 mb-4">Maximum power for high-volume senior applications.</p>
                <div className="text-3xl font-black text-white mb-6">
                  {billingCycle === 'monthly' ? '$39' : '$31'}{' '}
                  <span className="text-xs font-medium text-slate-400">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ Everything in Professional</li>
                  <li className="flex items-center gap-2">✓ Unlimited Tailored Resumes &amp; Portfolios</li>
                  <li className="flex items-center gap-2">✓ Advanced Technical Mock Drills</li>
                  <li className="flex items-center gap-2">✓ Multi-Persona Resume Studio (5 Profiles)</li>
                  <li className="flex items-center gap-2">✓ 24/7 Fast-Track Priority Channel</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openAuth('sign-up')}
                className="mt-8 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Choose Executive Plan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. INTERACTIVE FAQ ACCORDION */}
      <section id="faq" className="py-20 lg:py-28 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 mb-3">Questions &amp; Answers</h2>
          <p className="text-3xl font-extrabold text-white tracking-tight">Frequently Asked Questions</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => setActiveFaq((curr) => (curr === idx ? null : idx))}
                className="w-full text-left p-6 font-bold text-sm sm:text-base text-white flex items-center justify-between gap-4"
              >
                <span>{faq.q}</span>
                <span className="text-indigo-400 text-lg">{activeFaq === idx ? '−' : '+'}</span>
              </button>
              {activeFaq === idx && (
                <div className="px-6 pb-6 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/60 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 9. BOTTOM CONVERSION CTA BANNER */}
      <section className="py-16 bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 border-t border-slate-800 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-4">
            Stop filling endless forms manually.
          </h2>
          <p className="text-base text-indigo-200 mb-8 max-w-xl mx-auto">
            Take control of your applications with deterministic AI accuracy. Join over 12,000+ candidates landing interviews.
          </p>
          <button
            type="button"
            onClick={() => openAuth('sign-up')}
            className="py-4 px-8 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-base shadow-xl transition-all duration-200 active:scale-[0.99]"
          >
            Create Your Free Account Now →
          </button>
        </div>
      </section>

      {/* 10. FOOTER */}
      <footer className="py-10 border-t border-slate-900 bg-slate-950 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-300">PROGENI AUTOAPPLY</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} Progeni Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
          </div>
        </div>
      </footer>

      {/* AUTHENTICATION POPUP MODAL */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        nextPath="/dashboard"
      />
    </div>
  );
}
