'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  requestPasswordReset,
  resendSignupOtp,
  signIn,
  signInWithGoogle,
  signUp,
  verifyEmailOtp,
  usesCloudAuthentication,
} from '../lib/api';

type AuthMode = 'sign-in' | 'sign-up' | 'verify-otp' | 'forgot-password';

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
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setMessage('');
      setIsSuccess(false);
      setOtp('');
      setResendCountdown(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, initialMode]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (mode !== 'verify-otp' || resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, resendCountdown]);

  // Handle ESC key to close modal
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

    if (mode !== 'forgot-password' && mode !== 'verify-otp' && password.length < 8) {
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'forgot-password') {
        await requestPasswordReset(email.trim());
        setIsSuccess(true);
        setMessage('Password reset instructions sent. Please check your email inbox.');
      } else if (mode === 'sign-up') {
        const sessionCreated = await signUp(email.trim(), password);
        if (!sessionCreated) {
          setMode('verify-otp');
          setResendCountdown(60);
          setIsSuccess(true);
          setMessage(`Verification code dispatched to ${email.trim()}. Enter the 6-digit code below.`);
        } else {
          window.location.replace(nextPath);
        }
      } else if (mode === 'verify-otp') {
        if (otp.trim().length < 6) {
          setMessage('Please enter the full 6-digit verification code.');
          setBusy(false);
          return;
        }
        await verifyEmailOtp(email.trim(), otp.trim());
        setIsSuccess(true);
        setMessage('Email verified successfully! Setting up your workspace…');
        setTimeout(() => {
          window.location.replace(nextPath);
        }, 800);
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

  async function handleResendCode() {
    if (resendCountdown > 0 || busy) return;
    setBusy(true);
    setMessage('');
    setIsSuccess(false);
    try {
      await resendSignupOtp(email.trim());
      setResendCountdown(60);
      setIsSuccess(true);
      setMessage(`A fresh 6-digit verification code has been sent to ${email.trim()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not resend verification code.');
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
    mode === 'verify-otp'
      ? 'Verify your email'
      : mode === 'sign-up'
        ? 'Create your free account'
        : mode === 'forgot-password'
          ? 'Reset your password'
          : 'Sign in to Progeni';

  const subheading =
    mode === 'verify-otp'
      ? `We sent a 6-digit verification code to ${email || 'your email'}.`
      : mode === 'sign-up'
        ? 'Set your password and verify via OTP code to start matching.'
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
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-on-surface"
        >
          ✕
        </button>

        {/* Brand Lockup */}
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
            P
          </div>
          <div>
            <span className="block text-xs font-bold tracking-tight">
              PROGENI <span className="text-primary font-extrabold">AUTOAPPLY</span>
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-on-surface-variant">
              Enterprise Candidate Suite
            </span>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold tracking-tight text-on-surface">{heading}</h2>
        <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">{subheading}</p>

        {/* Mode Switcher Tabs (Hidden during OTP verification) */}
        {mode !== 'verify-otp' && (
          <div className="mt-5 grid grid-cols-2 rounded-xl bg-surface-subtle p-1 border border-outline-variant/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('sign-in');
                setMessage('');
                setIsSuccess(false);
              }}
              className={`rounded-lg py-1.5 transition-colors ${
                mode === 'sign-in'
                  ? 'bg-surface text-on-surface shadow-soft'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('sign-up');
                setMessage('');
                setIsSuccess(false);
              }}
              className={`rounded-lg py-1.5 transition-colors ${
                mode === 'sign-up'
                  ? 'bg-surface text-on-surface shadow-soft'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Create account
            </button>
          </div>
        )}

        {/* Notification Banner */}
        {message && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
              isSuccess
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-danger/30 bg-danger/10 text-danger'
            }`}
          >
            {message}
          </div>
        )}

        {/* AUTH FORM */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          {/* STEP: OTP VERIFICATION */}
          {mode === 'verify-otp' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-on-surface mb-2">
                  6-Digit Verification Code (OTP)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-xl border border-outline bg-surface-subtle px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.5em] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <span className="mt-1.5 block text-center text-[11px] text-on-surface-variant">
                  Code sent to <strong className="text-on-surface">{email}</strong>
                </span>
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={busy || otp.length < 6}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Verifying Code…' : 'Verify & Activate Account'}
              </button>

              {/* Resend & Change Email Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant text-xs">
                <button
                  type="button"
                  disabled={resendCountdown > 0 || busy}
                  onClick={handleResendCode}
                  className="text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                >
                  {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend OTP Code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    setMessage('');
                    setIsSuccess(false);
                    setOtp('');
                  }}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  Change Email
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Email Field */}
              <div>
                <label className="block text-xs font-medium text-on-surface mb-1">
                  Work or Personal Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="candidate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Password Fields */}
              {mode !== 'forgot-password' && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-on-surface">Password</label>
                    {mode === 'sign-in' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot-password');
                          setMessage('');
                          setIsSuccess(false);
                        }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant hover:text-on-surface"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password (Sign-up only) */}
              {mode === 'sign-up' && (
                <div>
                  <label className="block text-xs font-medium text-on-surface mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                  />
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>An email verification code (OTP) will be sent upon submission.</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? 'Processing…'
                  : mode === 'sign-up'
                    ? 'Create Account & Send OTP'
                    : mode === 'forgot-password'
                      ? 'Send Recovery Instructions'
                      : 'Sign in to Progeni'}
              </button>

              {/* Google OAuth Option */}
              {usesCloudAuthentication && mode !== 'forgot-password' && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-outline-variant" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-on-surface-variant">
                      <span className="bg-surface px-2">or continue with</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline bg-surface py-2.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27a7.1 7.1 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Google Workspace</span>
                  </button>
                </>
              )}

              {/* Back to sign in link for password reset */}
              {mode === 'forgot-password' && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('sign-in');
                      setMessage('');
                      setIsSuccess(false);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer Guarantee */}
        <div className="mt-5 border-t border-outline-variant pt-3.5 text-center text-[11px] text-on-surface-variant">
          <span>By signing in, you agree to our </span>
          <Link href="/privacy" className="text-on-surface underline hover:text-primary">
            Privacy Policy
          </Link>
          <span> and verified-data charter.</span>
        </div>
      </div>
    </div>
  );
}
