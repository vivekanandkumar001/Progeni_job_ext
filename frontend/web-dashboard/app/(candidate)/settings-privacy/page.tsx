'use client';

import { useState } from 'react';
import { clearWorkspace } from '../../../lib/api';

export default function PrivacySettingsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleClear() {
    if (!window.confirm('Delete your local profile, saved jobs, match results, and application tracker? This cannot be undone.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await clearWorkspace();
      window.location.replace('/dashboard');
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Could not clear local workspace data.');
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div><p className="eyebrow">YOUR DATA, YOUR CHOICE</p><h1>Privacy & data</h1><p>Review how the local MVP handles your career information and clear it whenever you want.</p></div>
      </header>

      <section className="card card-padding" style={{ maxWidth: 820 }}>
        <h2 className="card-title">Local development storage</h2>
        <p className="card-description" style={{ marginTop: 9, lineHeight: 1.8 }}>
          Your profile, job details, match results, and application tracker are saved in
          a local JSON file under <code>%LOCALAPPDATA%\ProgeniAutoApply</code>. The
          extension reads supported job pages only after you click Detect. The local MVP
          does not send candidate data to AI providers or job sites.
        </p>
        <div className="notice" style={{ marginTop: 16 }}>
          This local development storage is not encrypted at the application layer and
          is not ready for a production deployment or Chrome Web Store release. Do not
          use it for sensitive information on a shared device.
        </div>
        <h3 className="card-title" style={{ marginTop: 24 }}>Clear local workspace</h3>
        <p className="card-description" style={{ marginTop: 8, lineHeight: 1.7 }}>
          This deletes your saved profile, jobs, match results, and application history,
          and withdraws your local data consent. You will be asked to consent again if
          you continue using the workspace.
        </p>
        <button className="button" style={{ marginTop: 14, color: '#a23f4c', borderColor: '#f0d7db', background: '#fff8f8' }} disabled={busy} onClick={() => void handleClear()}>
          {busy ? 'Clearing…' : 'Clear local data and withdraw consent'}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
