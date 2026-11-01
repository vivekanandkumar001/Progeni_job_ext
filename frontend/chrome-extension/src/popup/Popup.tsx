import React, { useEffect, useState } from 'react';
import { makeRequestId, sendMessage } from '../shared/messages';

interface ResponseData {
  ok?: boolean;
  accepted?: boolean;
  supported?: boolean;
  status?: string;
  job?: { title?: string; company?: string };
  error?: string;
}

export default function Popup() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [job, setJob] = useState<ResponseData['job'] | null>(null);

  useEffect(() => {
    void refreshConsent();
  }, []);

  async function refreshConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not check the privacy notice.');
      setConsent(result.accepted === true);
      setStatus('');
    } catch (error) {
      setConsent(null);
      setStatus(error instanceof Error ? error.message : 'Local backend is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SAVE_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not save your consent.');
      setConsent(true);
      setStatus('Privacy notice accepted on this device.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your consent.');
    } finally {
      setBusy(false);
    }
  }

  async function detectJob() {
    setBusy(true);
    setStatus('Checking the active tab…');
    setJob(null);
    try {
      const activeTab = await sendMessage<ResponseData & { url?: string; tabId?: number }>({
        type: 'GET_ACTIVE_TAB',
      });
      if (!activeTab.ok) throw new Error(activeTab.error || 'Could not read the active tab.');
      if (!activeTab.url || activeTab.tabId === undefined) {
        throw new Error('Open a job page before detecting a job.');
      }
      const result = await sendMessage<ResponseData>({
        type: 'DETECT_REQUEST',
        url: activeTab.url,
        tabId: activeTab.tabId,
        requestId: makeRequestId(),
      });
      if (!result.ok) throw new Error(result.error || 'Job detection failed.');
      if (result.status !== 'supported') {
        setStatus('This site is not supported. You can enter job details in the dashboard.');
        return;
      }
      setJob(result.job || null);
      setStatus('Job details detected. Review them in the side panel before saving.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Job detection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function openDashboard() {
    await chrome.tabs.create({ url: 'http://localhost:3000/dashboard' });
    window.close();
  }

  return (
    <main className="popup">
      <header className="brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>Progeni AutoApply</strong>
          <span>Career workspace · local-first</span>
        </div>
      </header>

      {consent !== true ? (
        <section className="card">
          <h1>Before you begin</h1>
          <p>
            With your permission, Progeni reads job details only when you choose Detect.
            Your profile, detected jobs, and tracker are stored on this device by the
            local backend. They are not sent to an AI provider or job site.
          </p>
          <p className="muted">
            The local data file is not encrypted by this development build; use a trusted
            device only. You can withdraw consent by clearing Progeni local data.
            Submission is always manual.
          </p>
          <button className="primary" disabled={busy || consent === null} onClick={acceptConsent}>
            {busy ? 'Connecting…' : 'I agree and continue'}
          </button>
          {consent === null && (
            <button className="secondary" disabled={busy} onClick={() => void refreshConsent()}>
              Retry connection
            </button>
          )}
        </section>
      ) : (
        <>
          <section className="card">
            <div className="section-heading">
              <div>
                <h1>Current job</h1>
                <p>Detect job details only when you ask.</p>
              </div>
              <span className="local-badge">LOCAL</span>
            </div>
            {job && (
              <div className="job-preview">
                <strong>{job.title || 'Untitled job'}</strong>
                <span>{job.company || 'Company not detected'}</span>
              </div>
            )}
            <button className="primary" disabled={busy} onClick={() => void detectJob()}>
              {busy ? 'Working…' : 'Detect this job'}
            </button>
            <button className="secondary" onClick={() => void sendMessage({ type: 'OPEN_SIDE_PANEL' })}>
              Open career side panel
            </button>
            <button className="text-button" onClick={() => void openDashboard()}>
              Open dashboard
            </button>
          </section>
          <p className="policy-note">
            Manual review and submission only. Progeni never clicks Apply or bypasses
            platform controls.
          </p>
        </>
      )}
      {status && <p className="status" role="status">{status}</p>}
    </main>
  );
}
