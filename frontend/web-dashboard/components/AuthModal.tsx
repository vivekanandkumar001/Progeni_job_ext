'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  requestPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  usesCloudAuthentication,
} from '../lib/api';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  nextPath?: string;
}

const inputClass =
  'w-full rounded-xl border border-outline bg-surface-subtle px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/15';

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'sign-in',
  nextPath = '/dashboard',
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setMessage('');
      setIsSuccess(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialMode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSuccess(false);

    if (mode === 'sign-up' && password !== confirmPassword) {
      setMessage('Passwords do not match. Please verify both entries.');
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
        setIsSuccess(true);
        setMessage('Password reset instructions sent. Please check your email.');
      } else if (mode === 'sign-up') {
        const sessionCreated = await signUp(email.trim(), password);
        if (!sessionCreated) {
          setIsSuccess(true);
          setMessage('Check your email inbox to verify your account, then sign in.');
        } else {
          window.location.replace(nextPath);
        }
      } else {
        await signIn(email.trim(), password);
        window.location.replace(nextPath);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed. Please check credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setMessage('');
    setIsSuccess(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not initialize Google authentication.');
      setBusy(false);
    }
  }

  const heading =
    mode === 'sign-up'
      ? 'Create your free account'
      : mode === 'forgot-password'
        ? 'Reset your password'
        : 'Sign in to Progeni';

  const subheading =
    mode === 'sign-up'
      ? 'Start matching jobs and generating verified applications.'
      : mode === 'forgot-password'
        ? 'Enter your registered email to receive reset instructions.'
        : 'Access your matched jobs, tailored resumes, and pipeline.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-outline-variant bg-surface p-6 shadow-card sm:p-7">
        <button
          type="button"
          aria-label="Close authentication modal"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
        >
          ✕
        </button>

        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
            P
          </span>
          <div className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">
              PROGENI <span className="text-primary">AUTOAPPLY</span>
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
              Candidate workspace
            </span>
          </div>
        </div>

        {mode !== 'forgot-password' && (
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-outline-variant bg-surface-subtle p-1">
            {(['sign-in', 'sign-up'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setMode(tab);
                  setMessage('');
                  setIsSuccess(false);
                }}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${ mode === tab ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface' }`}}
              >
                {tab === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        <h2 className="text-lg font-bold tracking-tight">{heading}</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">{subheading}</p>

        {mode !== 'forgot-password' && usesCloudAuthentication && (
          <div className="mt-5">
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
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant" />
              </div>
              <span className="relative bg-surface px-3 text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                or with email
              </span>
            </div>
          </div>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
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
              placeholder="candidate@example.com"
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
                      setIsSuccess(false);
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
                  placeholder="At least 8 characters"
                  className={`${inputClass} pr-10`}}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
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
                placeholder="Re-enter password"
                className={inputClass}
              />
            </div>
          )}

          {message && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-[11px] ${ isSuccess ? 'border-success/30 bg-success-container text-on-success-container' : 'border-danger/30 bg-danger-container text-on-danger-container' }`}}
              role="alert"
            >
              <span className="shrink-0">{isSuccess ? '✓' : '⚠'}</span>
              <span>{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
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
                    ? 'Send reset link'
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
                setIsSuccess(false);
              }}
              className="text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        <div className="mt-5 border-t border-outline-variant pt-4 text-center">
          <p className="text-[10.5px] leading-relaxed text-on-surface-variant">
            By continuing you agree to Progeni&apos;s{' '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-on-surface">
              Privacy Policy
            </Link>
            . Applications are never submitted without your review.
          </p>
        </div>
      </div>
    </div>
  );
}
