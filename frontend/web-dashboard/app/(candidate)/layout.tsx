'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { acceptConsent, getConsent } from '../../lib/api';

const navigation = [
  { href: '/dashboard', label: 'Overview', symbol: '⌂' },
  { href: '/candidate-profile', label: 'Career profile', symbol: '◉' },
  { href: '/resume-manager', label: 'Resume intelligence', symbol: '▧' },
  { href: '/application-assistant', label: 'Prepare & review', symbol: '✓' },
  { href: '/application-tracker', label: 'Application tracker', symbol: '▤' },
  { href: '/settings-privacy', label: 'Privacy & data', symbol: '◇' },
];

type ConsentState = 'loading' | 'required' | 'accepted' | 'unavailable';

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkConsent() {
    setBusy(true);
    try {
      setConsent((await getConsent()) ? 'accepted' : 'required');
      setMessage('');
    } catch (error) {
      setConsent('unavailable');
      setMessage(error instanceof Error ? error.message : 'Local backend is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void checkConsent();
  }, []);

  async function giveConsent() {
    setBusy(true);
    try {
      await acceptConsent();
      setConsent('accepted');
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your consent.');
    } finally {
      setBusy(false);
    }
  }

  if (consent !== 'accepted') {
    return (
      <main className="consent-screen">
        <section className="consent-card">
          <div className="brand-lockup"><span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span></div>
          {consent === 'loading' ? (
            <><h1>Connecting to your local workspace</h1><p>Your profile and job data stay on this device.</p></>
          ) : consent === 'unavailable' ? (
            <>
              <h1>Local backend unavailable</h1>
              <p>{message || 'Start the backend from the backend folder, then retry.'}</p>
              <button className="button button-primary" disabled={busy} onClick={() => void checkConsent()}>
                Retry connection
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">YOUR DATA, YOUR CONTROL</p>
              <h1>Before you build your career workspace</h1>
              <p>
                Your career profile, job details, match results, and application tracker
                are saved on this device by the local Progeni backend. The extension
                reads a job page only when you choose Detect. This MVP does not send
                your information to AI providers or job sites.
              </p>
              <p>
                If you choose Resume intelligence, the local backend reads your selected
                PDF, DOCX, or text file to suggest profile details and skill evidence.
                The original file and full extracted text are not saved. Only details you
                review and confirm are added to the local workspace, which is not encrypted.
              </p>
              <p>
                Review every application yourself. Progeni does not submit applications,
                bypass platform controls, or claim that a job was submitted automatically.
              </p>
              <p>
                This development build does not encrypt the local data file. Use it only
                on a trusted device; public release requires stronger storage protection.
              </p>
              <button className="button button-primary" disabled={busy} onClick={() => void giveConsent()}>
                {busy ? 'Saving…' : 'I agree and continue'}
              </button>
              {message && <p className="form-error" role="alert">{message}</p>}
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand-lockup" href="/dashboard">
          <span className="brand-mark">P</span><span>PROGENI <b>AUTOAPPLY</b></span>
        </Link>
        <p className="sidebar-caption">YOUR CAREER WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? ' nav-link-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-symbol" aria-hidden="true">{item.symbol}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <span className="online-dot" />
          <div><strong>Local-first mode</strong><span>Your workspace stays on this device</span></div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>Candidate workspace</span>
          <span className="local-pill"><span className="online-dot" /> LOCAL DATA</span>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
