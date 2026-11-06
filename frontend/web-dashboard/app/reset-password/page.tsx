'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { getSupabaseClient, updatePassword } from '../../lib/api';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('Verifying your password reset link…');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setMessage('');
    try {
      await updatePassword(password);
      window.location.replace('/dashboard');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update your password.');
      setBusy(false);
    }
  }

  return (
    <main className="consent-screen">
      <section className="consent-card">
        <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password</h1>
        {verified ? (
          <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label className="field field-full">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="button button-primary field-full" disabled={busy}>
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        ) : (
          <p>{message}</p>
        )}
        {message && <p className="form-error" role="alert">{message}</p>}
        <p><Link href="/login">Return to sign in</Link></p>
      </section>
    </main>
  );
}
