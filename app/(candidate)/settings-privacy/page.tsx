'use client';

import { useState } from 'react';
import { clearWorkspace, usesCloudAuthentication } from '../../../lib/api';

export default function PrivacySettingsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClear() {
    if (!window.confirm('Delete your saved profile, resume evidence, jobs, match results, and application tracker? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await clearWorkspace();
      window.location.replace('/dashboard');
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear workspace data.');
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div><p className="eyebrow">YOUR DATA, YOUR CHOICE</p><h1>Privacy & data</h1><p>Review how Progeni handles your career information and clear your workspace data.</p></div>
      </header>

      <section className="card card-padding" style={{ maxWidth: 820 }}>
        <h2 className="card-title">{usesCloudAuthentication ? 'Account workspace' : 'Local development storage'}</h2>
        <p className="card-description" style={{ marginTop: 9, lineHeight: 1.8 }}>
          Your profile, resume-derived evidence, job details, match results, and
          application tracker are {usesCloudAuthentication
            ? 'stored in MongoDB under your authenticated account.'
            : <>saved in a local JSON file under <code>%LOCALAPPDATA%\ProgeniAutoApply</code>.</>}
          {' '}The extension reads supported job pages only after you click Detect.
          Progeni does not send candidate data to AI providers or job sites.
        </p>
        <div className="notice" style={{ marginTop: 16 }}>
          Resume files are sent to the Progeni API for parsing; the original file and
          full extracted text are not retained. Only reviewed information is saved.
        </div>
        <h3 className="card-title" style={{ marginTop: 24 }}>Clear workspace data</h3>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          This deletes your profile, resume-derived details, saved jobs, match results,
          tracker entries, and consent record. Your Progeni account remains active.
        </p>
        <button className="button" style={{ marginTop: 14, color: '#a23f4c', borderColor: '#f0d7db', background: '#fff8f8' }} disabled={busy} onClick={() => void handleClear()}>
          {busy ? 'Clearing…' : 'Clear workspace data'}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
