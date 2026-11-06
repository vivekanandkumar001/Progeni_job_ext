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
import ThemeToggle from './ThemeToggle';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password';

interface AuthScreenProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
  nextPath?: string;
  subTitleText?: string;
}

const inputClass =
  'w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/15';

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

  const heading =
    mode === 'sign-up'
      ? 'Get started with Progeni'
      : mode === 'forgot-password'
        ? 'Reset your password'
        : 'Welcome back';

  return (
    <div className="flex min-h-screen flex-col bg-background text-on-surface lg:flex-row">
      {/* Brand / value panel */}
      <div className="relative hidden flex-1 overflow-hidden border-r border-outline-variant bg-surface-subtle lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-[100px]"
        />
        <div className="relative flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
              P
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                PROGENI <span className="text-primary">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                Candidate workspace
              </span>
            </span>
          </Link>
          <ThemeToggle size="sm" />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Grounded career intelligence
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight">
            Land more interviews with evidence-based applications.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            Match verified qualifications to real employer requirements, tailor ATS-ready
            resumes, and autofill applications with complete human review.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['Truth Engine', 'Every claim links to a verified record.'],
              ['ATS optimization', 'Transparent keyword gap scoring.'],
              ['Human approval', 'Nothing is submitted without you.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-outline-variant bg-surface p-4">
                <h2 className="text-xs font-semibold">{title}</h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-on-surface-variant">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-outline-variant pt-6">
            {[
              ['98.4%', 'ATS pass rate'],
              ['12,400+', 'Applications tailored'],
              ['4.8×', 'Callback velocity'],
            ].map(([value, label]) => (
              <div key={label}>
                <div className="text-xl font-bold tracking-tight">{value}</div>
                <div className="text-[11px] text-on-surface-variant">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span className="text-success">✓</span>
          Encrypted workspace · No credentials shared with third parties
        </p>
      </div>

      {/* Auth form */}
      <div className="flex flex-1 items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                P
              </span>
              <span className="text-sm font-semibold tracking-tight">
                PROGENI <span className="text-primary">AUTOAPPLY</span>
              </span>
            </Link>
            <ThemeToggle size="sm" />
          </div>

          {mode !== 'forgot-password' && (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-outline-variant bg-surface-subtle p-1">
              {(['sign-in', 'sign-up'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setMessage('');
                    setIsSuccessMessage(false);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${ mode === tab ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface' }`}}
                >
                  {tab === 'sign-in' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant">
            {subTitleText ||
              (mode === 'sign-up'
                ? 'Create your private candidate profile and start applying smarter.'
                : mode === 'forgot-password'
                  ? 'Enter your account email to receive a password recovery link.'
                  : 'Access your matched jobs, tailored resumes, and application pipeline.')}
          </p>

          {configurationError && (
            <div className="mt-5 rounded-xl border border-warning/30 bg-warning-container p-3.5 text-[11px] text-on-warning-container">
              <div className="mb-1 font-semibold">Authentication notice</div>
              {configurationError}
            </div>
          )}

          {mode !== 'forgot-password' && usesCloudAuthentication && (
            <div className="mt-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGoogleLogin()}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-outline bg-surface px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-surface-variant disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>

              <div className="relative my-5 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant" />
                </div>
                <span className="relative bg-background px-3 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                  or with email
                </span>
              </div>
            </div>
          )}

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className={inputClass}
              />
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-on-surface-variant">
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
                      className="text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-on-surface-variant transition-colors hover:text-on-surface"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <label className="mb-1.5 block text-[11px] font-semibold text-on-surface-variant">
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
            )}

            {message && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 text-[11px] ${ isSuccessMessage ? 'border-success/30 bg-success-container text-on-success-container' : 'border-danger/30 bg-danger-container text-on-danger-container' }`}}
                role="alert"
              >
                <span className="shrink-0">{isSuccessMessage ? '✓' : '⚠'}</span>
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing…
                </>
              ) : (
                <span>
                  {mode === 'sign-up'
                    ? 'Create free account'
                    : mode === 'forgot-password'
                      ? 'Send recovery link'
                      : 'Sign in to workspace'}
                </span>
              )}
            </button>
          </form>

          {mode === 'forgot-password' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode('sign-in');
                  setMessage('');
                  setIsSuccessMessage(false);
                }}
                className="text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          <div className="mt-7 border-t border-outline-variant pt-5 text-center">
            <p className="text-[10.5px] leading-relaxed text-on-surface-variant">
              Job detection runs only when you click Detect in your extension.
              <br />
              Applications are never submitted automatically.
            </p>
            <div className="mt-2 flex items-center justify-center gap-2.5 text-[10.5px] text-on-surface-variant">
              <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-on-surface">
                Privacy policy
              </Link>
              <span aria-hidden>•</span>
              <span className="inline-flex items-center gap-1 text-success">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                Live platform
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
