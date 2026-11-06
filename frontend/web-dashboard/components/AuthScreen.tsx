'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getSupabaseClient,
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  usesCloudAuthentication,
} from '../lib/api';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password';

interface AuthScreenProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
  nextPath?: string;
  subTitleText?: string;
}

export default function AuthScreen({
  initialMode = 'sign-in',
  onSuccess,
  nextPath = '/dashboard',
  subTitleText,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [configurationError, setConfigurationError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const error = new URLSearchParams(window.location.search).get('error');
      if (error === 'configuration') {
        setConfigurationError('Account authentication is not configured for this deployment.');
      } else if (error === 'verification') {
        setMessage('Your session could not be verified. Please sign in again.');
      } else if (error === 'callback') {
        setMessage('The verification link is expired or invalid. Please sign in or request a new link.');
      }
    }

    try {
      getSupabaseClient();
    } catch (clientError) {
      if (usesCloudAuthentication) {
        setConfigurationError(
          clientError instanceof Error ? clientError.message : 'Account sign-in is unavailable.',
        );
      }
    }
  }, []);

  function handleNavigateAfterAuth() {
    if (onSuccess) {
      onSuccess();
    } else if (typeof window !== 'undefined') {
      const searchNext = new URLSearchParams(window.location.search).get('next');
      const target = searchNext && searchNext.startsWith('/') ? searchNext : nextPath;
      window.location.replace(target);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSuccessMessage(false);

    if (mode === 'sign-up' && password !== confirmPassword) {
      setMessage('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    if (mode !== 'forgot-password' && password.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'forgot-password') {
        await requestPasswordReset(email.trim());
        setIsSuccessMessage(true);
        setMessage('Password reset instructions sent. Please check your email inbox.');
      } else if (mode === 'sign-up') {
        const sessionCreated = await signUp(email.trim(), password);
        if (!sessionCreated) {
          setIsSuccessMessage(true);
          setMessage('Check your email to verify your account, then return to sign in.');
        } else {
          handleNavigateAfterAuth();
        }
      } else {
        await signIn(email.trim(), password);
        handleNavigateAfterAuth();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed. Please verify credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setMessage('');
    setIsSuccessMessage(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not initialize Google authentication.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col lg:flex-row antialiased text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* LEFT COLUMN: HERO & BRAND SHOWCASE */}
      <div className="relative flex-1 lg:w-7/12 flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80">
        {/* Ambient Decorative Lighting */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <span className="text-white font-black text-xl tracking-wider">P</span>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block">
                PROGENI <span className="text-indigo-400 font-extrabold">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                Intelligent Career Agent
              </span>
            </div>
          </Link>

          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 text-xs font-medium backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Precision Matching 2.0
          </div>
        </div>

        {/* Hero Narrative Section */}
        <div className="relative z-10 my-10 lg:my-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Zero-Hallucination Career Engine
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
            Land 4× more interviews with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-300">
              grounded AI accuracy.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300/90 leading-relaxed mb-8">
            Eliminate repetitive application forms. Match verified qualifications to real employer requirements,
            tailor bulletproof ATS resumes, and autofill job applications with complete human review.
          </p>

          {/* Pillars Grid */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm mb-3">
                ⚡
              </div>
              <h2 className="text-sm font-semibold text-white mb-1">Truth Engine</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                100% grounded claims. Every bullet point links directly to your verified career records.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm mb-3">
                🎯
              </div>
              <h2 className="text-sm font-semibold text-white mb-1">ATS Optimization</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Transparent keyword gap scoring for Greenhouse, Lever, Ashby, and Workday.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-3">
                🛡️
              </div>
              <h2 className="text-sm font-semibold text-white mb-1">Human Approval</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero secret submissions. You inspect, approve, and confirm every single application.
              </p>
            </div>
          </div>

          {/* Candidate Metric Bar */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-10 pt-6 border-t border-slate-800/60">
            <div>
              <div className="text-2xl font-black text-white">98.4%</div>
              <div className="text-xs text-slate-400">ATS Pass Rate</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-2xl font-black text-white">12,400+</div>
              <div className="text-xs text-slate-400">Applications Tailored</div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-2xl font-black text-white">4.8×</div>
              <div className="text-xs text-slate-400">Callback Velocity</div>
            </div>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="relative z-10 pt-6 flex items-center gap-3 text-xs text-slate-400">
          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>End-to-end encrypted workspace · Zero credentials shared with third parties</span>
        </div>
      </div>

      {/* RIGHT COLUMN: INTERACTIVE AUTH CARD */}
      <div className="flex-1 lg:w-5/12 flex items-center justify-center p-6 sm:p-10 lg:p-14 bg-slate-900/40 relative">
        <div className="w-full max-w-md mx-auto">
          {/* Card Wrapper */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl">
            {/* Tab Switcher */}
            {mode !== 'forgot-password' && (
              <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800/80 mb-7">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    setMessage('');
                    setIsSuccessMessage(false);
                  }}
                  className={`py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 ${
                    mode === 'sign-in'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    setMessage('');
                    setIsSuccessMessage(false);
                  }}
                  className={`py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 ${
                    mode === 'sign-up'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Context Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {mode === 'sign-up'
                  ? 'Get started with Progeni'
                  : mode === 'forgot-password'
                  ? 'Reset your password'
                  : 'Welcome back'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                {subTitleText ||
                  (mode === 'sign-up'
                    ? 'Create your private candidate profile and start auto applying.'
                    : mode === 'forgot-password'
                    ? 'Enter your account email to receive a password recovery link.'
                    : 'Access your matched jobs, tailored resumes, and application pipeline.')}
              </p>
            </div>

            {/* Configuration Error Notice */}
            {configurationError ? (
              <div className="p-4 rounded-xl bg-amber-950/50 border border-amber-800/60 text-amber-200 text-xs mb-6">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Authentication Notice
                </div>
                {configurationError}
              </div>
            ) : null}

            {/* Google OAuth Button */}
            {mode !== 'forgot-password' && usesCloudAuthentication && (
              <div className="mb-6">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGoogleLogin()}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-700/80 text-sm font-semibold text-white transition-all duration-200 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative flex items-center justify-center my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800" />
                  </div>
                  <span className="relative px-3 bg-slate-900 text-xs font-medium text-slate-400">
                    or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* Email / Password Form */}
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {mode !== 'forgot-password' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Password
                    </label>
                    {mode === 'sign-in' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot-password');
                          setMessage('');
                          setIsSuccessMessage(false);
                        }}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                      minLength={8}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'sign-up' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Status Message */}
              {message && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    isSuccessMessage
                      ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/50 border border-rose-800 text-rose-200'
                  }`}
                  role="alert"
                >
                  <span className="flex-shrink-0 text-sm">{isSuccessMessage ? '✓' : '⚠️'}</span>
                  <span>{message}</span>
                </div>
              )}

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:shadow-indigo-600/50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {busy ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Processing…</span>
                  </>
                ) : (
                  <span>
                    {mode === 'sign-up'
                      ? 'Create Free Account'
                      : mode === 'forgot-password'
                      ? 'Send Recovery Link'
                      : 'Sign In to Workspace'}
                  </span>
                )}
              </button>
            </form>

            {/* Back to sign in for forgot-password */}
            {mode === 'forgot-password' && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode('sign-in');
                    setMessage('');
                    setIsSuccessMessage(false);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  ← Back to sign in
                </button>
              </div>
            )}

            {/* Safety & Compliance Micro-copy */}
            <div className="mt-7 pt-6 border-t border-slate-800/80 text-center space-y-2">
              <p className="text-[11px] text-slate-400">
                Job detection runs only when you click Detect in your extension.
                <br />
                Applications are never submitted automatically.
              </p>
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-3">
                <Link href="/privacy" className="hover:text-indigo-400 transition-colors underline underline-offset-2">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link href="/privacy" className="hover:text-indigo-400 transition-colors underline underline-offset-2">
                  Security Details
                </Link>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Live Platform
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
