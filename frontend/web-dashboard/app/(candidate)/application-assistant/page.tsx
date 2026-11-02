'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getApplications,
  getProfile,
  updateApplication,
  type CandidateProfile,
  type TrackedApplication,
} from '../../../lib/api';

const preparedFields: Array<{ label: string; key: keyof CandidateProfile }> = [
  { label: 'Full name', key: 'fullName' },
  { label: 'Email', key: 'email' },
  { label: 'Phone', key: 'phone' },
  { label: 'Target role', key: 'targetRole' },
  { label: 'Location', key: 'location' },
  { label: 'Years of experience', key: 'experienceYears' },
  { label: 'Skills', key: 'skills' },
];

export default function ApplicationAssistantPage() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void Promise.all([getProfile(), getApplications()]).then(([savedProfile, savedApplications]) => {
      setProfile(savedProfile);
      setApplications(savedApplications);
      setSelectedId(savedApplications[0]?.id || '');
    }).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your preparation workspace.');
    });
  }, []);

  const selectedApplication = applications.find((application) => application.id === selectedId);

  function getAnswer(key: keyof CandidateProfile): string {
    const value = profile?.[key];
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return `${value} years`;
    return typeof value === 'string' ? value : '';
  }

  async function copyAnswer(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied. Review it before using it.`);
      setError('');
    } catch {
      setError('Clipboard access was denied. Select and copy the answer manually.');
      setNotice('');
    }
  }

  async function markPrepared() {
    if (!selectedApplication) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateApplication(selectedApplication.id, 'prepared');
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice('Marked prepared for your review. No information was submitted.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update this application.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div><p className="eyebrow">APPLICATION ASSISTANT</p><h1>Prepare, then review.</h1><p>Use your saved profile as a reference. You control what goes into each application.</p></div>
        <Link className="button button-secondary" href="/application-tracker">Open tracker</Link>
      </header>

      <div className="notice" style={{ marginBottom: 16 }}>
        These are profile-based answer suggestions for manual use. Progeni does not fill or submit forms. Answer screening, eligibility, legal, demographic, and other subjective questions yourself—never use an invented answer.
      </div>

      <section className="card card-padding">
        <label className="field" style={{ maxWidth: 520 }}>
          Choose a tracked opportunity
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Select a job…</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.job.title}{application.job.company ? ` · ${application.job.company}` : ''}
              </option>
            ))}
          </select>
        </label>

        {!selectedApplication ? (
          <div className="empty-state">
            Add a discovered job to your tracker before preparing its details.
            <div style={{ marginTop: 14 }}><Link className="button button-secondary" href="/dashboard">Analyze a job</Link></div>
          </div>
        ) : (
          <>
            <div className="list-row" style={{ marginTop: 18 }}>
              <div className="list-row-main"><strong>{selectedApplication.job.title}</strong><span>{selectedApplication.job.company || 'Company not listed'} · {selectedApplication.job.location || 'Location not listed'}</span></div>
              <span className="score-chip" style={{ minWidth: 90 }}>{selectedApplication.status}</span>
            </div>
            <h2 className="card-title" style={{ marginTop: 24 }}>Profile-based answers</h2>
            <p className="card-description">Confirm every answer against your current information before using it.</p>
            <div className="form-grid" style={{ marginTop: 10 }}>
              {preparedFields.map(({ label, key }) => {
                const answer = getAnswer(key);
                return (
                  <div className="field" key={key}>
                    <span>{label}</span>
                    <div className="list-row" style={{ padding: '9px 0', alignItems: 'center' }}>
                      <span style={{ color: answer ? '#364159' : '#9aa0ae', fontWeight: 500 }}>{answer || 'Not provided'}</span>
                      <button className="button button-secondary" disabled={!answer} onClick={() => void copyAnswer(label, answer)}>Copy</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ marginTop: 18, padding: 16, background: '#fbfaff' }}>
              <h3 className="card-title">Questions that need your judgment</h3>
              <p className="card-description">Write truthful responses yourself for “Why this role?”, salary expectations, work authorization, accommodations, and screening questions. The MVP does not generate these answers.</p>
            </div>
            <div className="form-actions">
              <button className="button button-primary" disabled={busy || selectedApplication.status === 'prepared'} onClick={() => void markPrepared()}>
                {busy ? 'Saving…' : selectedApplication.status === 'prepared' ? 'Marked prepared' : 'Mark prepared for review'}
              </button>
              <span className="card-description">This only updates your workspace tracker.</span>
            </div>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
      </section>
    </div>
  );
}
