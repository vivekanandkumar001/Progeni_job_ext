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
      // Prevent background scrolling
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialMode]);

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/60 overflow-hidden text-slate-100">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-32 bg-gradient-to-b from-indigo-500/20 to-transparent blur-2xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          type="button"
          aria-label="Close authentication modal"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
        >
          ✕
        </button>

        {/* Brand Lockup */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-black text-xl">P</span>
          </div>
          <div>
            <span className="text-base font-bold text-white block">
              PROGENI <span className="text-indigo-400 font-extrabold">AUTOAPPLY</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
              Candidate Workspace
            </span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        {mode !== 'forgot-password' && (
          <div className="grid grid-cols-2 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('sign-in');
                setMessage('');
                setIsSuccess(false);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 ${
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
                setIsSuccess(false);
              }}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 ${
                mode === 'sign-up'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Heading & Subtitle */}
        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {mode === 'sign-up'
              ? 'Create your free account'
              : mode === 'forgot-password'
              ? 'Reset account password'
              : 'Sign in to Progeni'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {mode === 'sign-up'
              ? 'Start matching jobs and generating verified applications.'
              : mode === 'forgot-password'
              ? 'Enter your registered email address to receive reset instructions.'
              : 'Access your matched jobs, tailored resumes, and application pipeline.'}
          </p>
        </div>

        {/* Google OAuth Button */}
        {mode !== 'forgot-password' && usesCloudAuthentication && (
          <div className="mb-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleLogin()}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-sm font-semibold text-white transition-all duration-200 hover:border-slate-600 disabled:opacity-50 shadow-sm active:scale-[0.99]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative px-3 bg-slate-900 text-xs font-medium text-slate-500">
                or with email
              </span>
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
            />
          </div>

          {mode !== 'forgot-password' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
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
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
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
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 transition-colors"
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
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Feedback Banner */}
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                isSuccess
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-200'
              }`}
              role="alert"
            >
              <span className="flex-shrink-0">{isSuccess ? '✓' : '⚠️'}</span>
              <span>{message}</span>
            </div>
          )}

          {/* Primary CTA Button */}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
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
                  ? 'Send Reset Link'
                  : 'Sign In to Workspace'}
              </span>
            )}
          </button>
        </form>

        {/* Return to sign in option for forgot password */}
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
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* Modal Footer Micro-copy */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400">
            By continuing, you agree to Progeni&apos;s{' '}
            <Link href="/privacy" className="underline hover:text-indigo-400">
              Privacy Policy
            </Link>
            . Applications are never submitted automatically without your review.
          </p>
        </div>
      </div>
    </div>
  );
}

