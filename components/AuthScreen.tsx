'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getSupabaseClient,
  requestPasswordReset,
  resendSignupOtp,
  signIn,
  signInWithGoogle,
  signUp,
  verifyEmailOtp,
  usesCloudAuthentication,
} from '../lib/api';
import ThemeToggle from './ThemeToggle';

type AuthMode = 'sign-in' | 'sign-up' | 'verify-otp' | 'forgot-password';

interface AuthScreenProps {
  initialMode?: AuthMode;
  onSuccess?: () => void;
  nextPath?: string;
  subTitleText?: string;
}

const inputClass =
  'w-full rounded-xl border border-outline bg-surface px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 outline-none transition-colors focus:border-primary/70 focus:ring-2 focus:ring-primary/15';

function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) return 'Authentication failed. Please verify credentials.';
  const msg = error.message.toLowerCase();

  if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('email rate limit exceeded')) {
    return 'Email rate limit reached. Please check your inbox (and Spam folder) for the verification code sent earlier. If you did not receive it, wait 2-3 minutes before resending, or configure custom SMTP in Supabase.';
  }
  if (msg.includes('user already registered') || msg.includes('already exists') || msg.includes('identity already exists')) {
    return 'An account with this email already exists. You can sign in directly with your password, or enter the code sent to your email to verify.';
  }
  if (msg.includes('invalid credentials') || msg.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please verify and try again.';
  }
  if (msg.includes('token has expired') || msg.includes('otp has expired')) {
    return 'This verification code has expired. Please click "Resend OTP Code" to get a fresh code.';
  }
  if (msg.includes('token is invalid') || msg.includes('invalid token')) {
    return 'Invalid verification code. Please double-check the 6 digits from your email.';
  }
  return error.message;
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
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
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

  // OTP Resend countdown
  useEffect(() => {
    if (mode !== 'verify-otp' || resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, resendCountdown]);

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

    if (mode !== 'forgot-password' && mode !== 'verify-otp' && password.length < 8) {
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
        try {
          const sessionCreated = await signUp(email.trim(), password);
          if (!sessionCreated) {
            setMode('verify-otp');
            setResendCountdown(60);
            setIsSuccessMessage(true);
            setMessage(`Verification code dispatched to ${email.trim()}. Enter the 6-digit code below.`);
          } else {
            handleNavigateAfterAuth();
          }
        } catch (signUpErr) {
          const rawErr = signUpErr instanceof Error ? signUpErr.message.toLowerCase() : '';
          if (rawErr.includes('rate limit') || rawErr.includes('already registered')) {
            setMode('verify-otp');
            setResendCountdown(60);
            setMessage(
              'A verification code was previously sent to your email. Check your inbox and spam folder, then enter the 6-digit code below.'
            );
          } else {
            throw signUpErr;
          }
        }
      } else if (mode === 'verify-otp') {
        if (otp.trim().length < 6) {
          setMessage('Please enter the full 6-digit verification code.');
          setBusy(false);
          return;
        }
        await verifyEmailOtp(email.trim(), otp.trim());
        setIsSuccessMessage(true);
        setMessage('Email verified successfully! Setting up your workspace…');
        setTimeout(() => {
          handleNavigateAfterAuth();
        }, 800);
      } else {
        await signIn(email.trim(), password);
        handleNavigateAfterAuth();
      }
    } catch (error) {
      setMessage(formatAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    if (resendCountdown > 0 || busy) return;
    setBusy(true);
    setMessage('');
    setIsSuccessMessage(false);
    try {
      await resendSignupOtp(email.trim());
      setResendCountdown(60);
      setIsSuccessMessage(true);
      setMessage(`A fresh 6-digit verification code has been dispatched to ${email.trim()}.`);
    } catch (error) {
      setMessage(formatAuthError(error));
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
    mode === 'verify-otp'
      ? 'Verify your email'
      : mode === 'sign-up'
        ? 'Create your candidate account'
        : mode === 'forgot-password'
          ? 'Reset your password'
          : 'Welcome back';

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-on-surface antialiased lg:flex-row">
      {/* LEFT COLUMN: HERO VALUE PROP */}
      <div className="relative flex flex-1 flex-col justify-between border-b border-outline-variant bg-gradient-to-br from-surface via-surface-subtle to-surface-variant/40 p-8 sm:p-12 lg:w-7/12 lg:border-b-0 lg:border-r lg:p-16">
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-sm shadow-indigo-500/25">
              P
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                PROGENI <span className="text-primary font-bold">AUTOAPPLY</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
                Career agent
              </span>
            </span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="relative z-10 my-10 max-w-xl lg:my-auto">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span>🛡️</span>
            <span>Zero-Hallucination Verified Applications</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            Land 4× more interviews with <span className="text-primary">grounded AI accuracy.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-on-surface-variant">
            Eliminate repetitive application forms. Match verified qualifications to real employer requirements,
            tailor bulletproof ATS resumes, and autofill job applications with complete candidate approval.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-outline-variant bg-surface p-4 shadow-soft">
              <div className="text-xl font-bold tracking-tight text-on-surface">12.4k+</div>
              <div className="mt-1 text-xs text-on-surface-variant">Verified Resumes</div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface p-4 shadow-soft">
              <div className="text-xl font-bold tracking-tight text-success">98.4%</div>
              <div className="mt-1 text-xs text-on-surface-variant">ATS Pass Rate</div>
            </div>
            <div className="rounded-2xl border border-outline-variant bg-surface p-4 shadow-soft">
              <div className="text-xl font-bold tracking-tight text-primary">4.8×</div>
              <div className="mt-1 text-xs text-on-surface-variant">Interview Callbacks</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-on-surface-variant">
          <span>Enterprise privacy standards · Supabase Auth · MongoDB Atlas</span>
        </div>
      </div>

      {/* RIGHT COLUMN: AUTHENTICATION FORM */}
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-10 lg:w-5/12 lg:p-14">
        <div className="mx-auto w-full max-w-sm">
          {/* TABS (Hidden during OTP verification) */}
          {mode !== 'verify-otp' && (
            <div className="mb-6 grid grid-cols-2 rounded-xl border border-outline-variant/80 bg-surface-subtle p-1">
              {(['sign-in', 'sign-up'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setMessage('');
                    setIsSuccessMessage(false);
                  }}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    mode === tab
                      ? 'bg-surface text-on-surface shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab === 'sign-in' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
          )}

          <h2 className="text-xl font-bold tracking-tight">{heading}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant">
            {subTitleText ||
              (mode === 'verify-otp'
                ? `Enter the 6-digit code sent to ${email}.`
                : mode === 'sign-up'
                  ? 'Set your password and verify via OTP code to start matching.'
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

          {/* Prominent Error / Notice Banner */}
          {message && (
            <div
              className={`mt-4 rounded-xl border p-3.5 text-xs leading-relaxed ${
                isSuccessMessage
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {message}
            </div>
          )}

          {/* GOOGLE SIGN IN (Sign-in and Sign-up modes only) */}
          {mode !== 'forgot-password' && mode !== 'verify-otp' && usesCloudAuthentication && (
            <div className="mt-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGoogleLogin()}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-outline bg-surface px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-surface-variant disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
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

          {/* FORM */}
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3.5">
            {/* STEP: OTP VERIFICATION */}
            {mode === 'verify-otp' ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-on-surface">
                    Enter 6-Digit Verification Code (OTP)
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
                    className="w-full rounded-xl border border-outline bg-surface px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.5em] text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="mt-1.5 block text-center text-[11px] text-on-surface-variant">
                    Verification code sent to <strong className="text-on-surface">{email}</strong>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={busy || otp.length < 6}
                  className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Verifying Code…' : 'Verify & Activate Account'}
                </button>

                {/* Helpful spam / sign-in tip */}
                <div className="rounded-xl border border-outline-variant bg-surface-subtle p-3 text-[11px] leading-relaxed text-on-surface-variant">
                  <div className="flex items-start gap-2">
                    <span className="text-primary text-sm">💡</span>
                    <span>
                      Check your <strong>Spam / Promotions</strong> folder if not in primary inbox.
                      Already verified?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode('sign-in');
                          setMessage('');
                          setIsSuccessMessage(false);
                        }}
                        className="text-primary font-semibold underline hover:opacity-80"
                      >
                        Sign in with password
                      </button>
                    </span>
                  </div>
                </div>

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
                      setIsSuccessMessage(false);
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
                        className={`${inputClass} pr-10`}
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
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                      <span className="font-semibold text-success">✓</span>
                      <span>An email verification code (OTP) will be sent upon submission.</span>
                    </div>
                  </div>
                )}

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
              </>
            )}
          </form>

          {mode === 'forgot-password' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in');
                  setMessage('');
                  setIsSuccessMessage(false);
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Back to sign in
              </button>
            </div>
          )}

          <div className="mt-6 border-t border-outline-variant pt-4 text-center text-[11px] text-on-surface-variant">
            <span>By proceeding, you agree to our </span>
            <Link href="/privacy" className="text-on-surface underline hover:text-primary">
              Terms & Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
