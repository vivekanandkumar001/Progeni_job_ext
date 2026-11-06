'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseClient, updatePassword } from '../../lib/api';
import ThemeToggle from '../../components/ThemeToggle';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('Verifying your password reset link…');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Password recovery is unavailable in local development.');
      void client.auth.getSession().then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage(error.message);
        } else if (!data.session) {
          setMessage('This reset link is invalid or has expired. Request a new one.');
        } else {
          setVerified(true);
          setMessage('');
        }
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password recovery is unavailable.');
    }
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await updatePassword(password);
      setIsSuccess(true);
      setMessage('Password updated successfully! Redirecting to workspace…');
      setTimeout(() => {
        window.location.replace('/dashboard');
      }, 1500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your password.');
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-6 text-on-surface">
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-secondary/10 blur-2xl" />
      <ThemeToggle className="absolute right-4 top-4 z-20" />
      <section className="relative z-10 w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-8 shadow-card sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-md shadow-indigo-500/20">
            P
          </div>
          <div>
            <span className="block text-base font-semibold text-on-surface">
              PROGENI <span className="text-primary">AUTOAPPLY</span>
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-on-surface-variant">
              Account Security
            </span>
          </div>
        </div>

        <h1 className="mb-2 text-2xl font-semibold">Set New Password</h1>
        <p className="mb-6 text-xs text-on-surface-variant sm:text-sm">
          Choose a secure password of at least 8 characters to protect your candidate workspace.
        </p>

        {verified ? (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                Confirm New Password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-outline bg-surface px-4 py-2.5 text-sm text-on-surface transition-colors placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {message && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${ isSuccess ? 'border-success/30 bg-success-container text-on-success-container' : 'border-danger/30 bg-danger-container text-on-danger-container' }`}
                role="alert"
              >
                <span>{isSuccess ? '✓' : '⚠️'}</span>
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? 'Saving new password…' : 'Update Password & Access Workspace'}
            </button>
          </form>
        ) : (
          <div className="mb-6 rounded-xl border border-outline-variant bg-surface-subtle p-4 text-xs text-on-surface-variant">
            {message}
          </div>
        )}

        <div className="mt-6 border-t border-outline-variant pt-5 text-center">
          <Link href="/login" className="text-xs text-primary transition-colors hover:text-primary/80">
            ← Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
