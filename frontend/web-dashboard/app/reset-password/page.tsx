'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseClient, updatePassword } from '../../lib/api';

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
    <main className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-6 text-slate-100 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <section className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-black text-xl">P</span>
          </div>
          <div>
            <span className="text-base font-bold text-white block">
              PROGENI <span className="text-indigo-400">AUTOAPPLY</span>
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
              Account Security
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Set New Password</h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">
          Choose a secure password of at least 8 characters to protect your candidate workspace.
        </p>

        {verified ? (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  isSuccess
                    ? 'bg-emerald-950/50 border border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/50 border border-rose-800 text-rose-200'
                }`}
                role="alert"
              >
                <span>{isSuccess ? '✓' : '⚠️'}</span>
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all duration-200 active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {busy ? 'Saving new password…' : 'Update Password & Access Workspace'}
            </button>
          </form>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 mb-6">
            {message}
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <Link href="/login" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Return to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
