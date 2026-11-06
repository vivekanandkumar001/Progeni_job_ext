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
} from '../../lib/api';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password';

function getNextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/dashboard';
  }
  const destination = new URL(next, window.location.origin);
  return destination.origin === window.location.origin
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : '/dashboard';
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [configurationError, setConfigurationError] = useState('');

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    if (error === 'configuration') {
      setConfigurationError('Account sign-in is not configured for this deployment. Please contact support.');
    } else if (error === 'verification') {
      setMessage('We could not verify your saved session. Please sign in again.');
    } else if (error === 'callback') {
      setMessage('That sign-in link is invalid or expired. Please sign in or request a new link.');
    }

    try {
      getSupabaseClient();
    } catch (clientError) {
      setConfigurationError(
        clientError instanceof Error ? clientError.message : 'Account sign-in is unavailable.',
      );
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'forgot-password') {
        await requestPasswordReset(email.trim());
        setMessage('If an account exists for this email, a password reset link is on its way.');
      } else if (mode === 'sign-up') {
        const sessionCreated = await signUp(email.trim(), password);
        if (!sessionCreated) {
          setMessage('Check your email to confirm your account, then sign in.');
        } else {
          window.location.replace(getNextPath());
        }
      } else {
        await signIn(email.trim(), password);
        window.location.replace(getNextPath());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setMessage('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not initialize Google authentication.');
      setBusy(false);
    }
  }

  const heading = mode === 'sign-up'
    ? 'Create your account'
    : mode === 'forgot-password'
      ? 'Reset your password'
      : 'Sign in to Progeni';

  return (
    <main className="consent-screen">
      <section className="consent-card">
        <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
        <p className="eyebrow">YOUR ACCOUNT, YOUR WORKSPACE</p>
        <h1>{heading}</h1>
        <p>Your workspace is stored under your account and is available only after sign-in.</p>
        {!usesCloudAuthentication || configurationError ? (
          <p className="form-error" role="alert">
            {configurationError || 'Cloud sign-in is unavailable in local development.'}
          </p>
        ) : (
          <>
            <form className="form-grid" onSubmit={(event) => void submit(event)}>
              <label className="field field-full">
                Email
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {mode !== 'forgot-password' && (
                <label className="field field-full">
                  Password
                  <input
                    type="password"
                    autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              )}
              <button className="button button-primary field-full" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'forgot-password' ? 'Send reset link' : 'Sign in'}
              </button>
            </form>
            {mode !== 'forgot-password' && (
              <div style={{ margin: '1rem 0', textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>or continue with</p>
                <button
                  type="button"
                  className="button button-secondary field-full"
                  disabled={busy}
                  onClick={() => void handleGoogleLogin()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Google</span>
                </button>
              </div>
            )}
            {mode === 'sign-in' && (
              <button className="button button-secondary" disabled={busy} onClick={() => setMode('forgot-password')}>
                Forgot password?
              </button>
            )}
            {mode !== 'forgot-password' && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  setMode((current) => current === 'sign-up' ? 'sign-in' : 'sign-up');
                  setMessage('');
                }}
              >
                {mode === 'sign-up' ? 'Already have an account? Sign in' : 'New to Progeni? Create an account'}
              </button>
            )}
            {mode === 'forgot-password' && (
              <button className="button button-secondary" disabled={busy} onClick={() => setMode('sign-in')}>
                Return to sign in
              </button>
            )}
          </>
        )}
        {message && <p className="form-error" role="status">{message}</p>}
        <p><Link href="/privacy">Privacy policy</Link></p>
      </section>
    </main>
  );
}
