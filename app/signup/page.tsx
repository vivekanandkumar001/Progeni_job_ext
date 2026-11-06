'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getSupabaseClient,
  signInWithGoogle,
  signUp,
  usesCloudAuthentication,
} from '../../lib/api';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [configurationError, setConfigurationError] = useState('');

  useEffect(() => {
    try {
      getSupabaseClient();
    } catch (clientError) {
      setConfigurationError(
        clientError instanceof Error ? clientError.message : 'Account sign-up is unavailable.',
      );
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const sessionCreated = await signUp(email.trim(), password);
      if (!sessionCreated) {
        setMessage('Check your email to confirm your account, then sign in.');
      } else {
        window.location.replace('/dashboard');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create your account.');
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

  return (
    <main className="consent-screen">
      <section className="consent-card">
        <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
        <p className="eyebrow">YOUR ACCOUNT, YOUR WORKSPACE</p>
        <h1>Create your account</h1>
        <p>Get started with automated AI career intelligence and controlled auto apply.</p>
        {!usesCloudAuthentication || configurationError ? (
          <p className="form-error" role="alert">
            {configurationError || 'Cloud sign-up is unavailable in local development.'}
          </p>
        ) : (
          <>
            <form className="form-grid" onSubmit={(event) => void submit(event)}>
              <label className="field field-full">
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className="field field-full">
                Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="field field-full">
                Confirm Password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className="button button-primary field-full" disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
            </form>
            <div style={{ margin: '1rem 0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>or sign up with</p>
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
            <Link href="/login" className="button button-secondary" style={{ textAlign: 'center' }}>
              Already have an account? Sign in
            </Link>
          </>
        )}
        {message && <p className="form-error" role="status">{message}</p>}
        <p><Link href="/privacy">Privacy policy</Link></p>
      </section>
    </main>
  );
}

