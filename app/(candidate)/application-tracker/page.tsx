'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getApplications,
  updateApplication,
  type ApplicationStatus,
  type TrackedApplication,
} from '../../../lib/api';

const statuses: ApplicationStatus[] = [
  'discovered',
  'prepared',
  'submitted',
  'interview',
  'rejected',
  'withdrawn',
];

export default function ApplicationTrackerPage() {
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadApplications() {
    setLoading(true);
    setError('');
    try {
      setApplications(await getApplications());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the application tracker.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  async function changeStatus(application: TrackedApplication, status: ApplicationStatus) {
    setBusyId(application.id);
    setError('');
    setNotice('');
    try {
      const updated = await updateApplication(application.id, status);
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice('Status updated. This tracker reflects your own update; it does not verify a submission.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update this application.');
    } finally {
      setBusyId('');
    }
  }

  const counts = statuses.reduce<Record<ApplicationStatus, number>>((result, status) => {
    result[status] = applications.filter((application) => application.status === status).length;
    return result;
  }, {
    discovered: 0,
    prepared: 0,
    submitted: 0,
    interview: 0,
    rejected: 0,
    withdrawn: 0,
  });

  return (
    <div>
      <header className="page-heading">
        <div><p className="eyebrow">YOUR SEARCH HISTORY</p><h1>Application tracker</h1><p>Keep a clear record of the opportunities you discover and the steps you take.</p></div>
        <Link className="button button-primary" href="/dashboard">Analyze a job</Link>
      </header>

      <div className="stats-grid">
        <article className="card stat-card"><span className="stat-label">Discovered</span><strong className="stat-value">{counts.discovered}</strong><span className="stat-footnote">Saved for review</span></article>
        <article className="card stat-card"><span className="stat-label">Prepared</span><strong className="stat-value">{counts.prepared}</strong><span className="stat-footnote">Ready for your review</span></article>
        <article className="card stat-card"><span className="stat-label">Submitted</span><strong className="stat-value">{counts.submitted}</strong><span className="stat-footnote">Marked by you</span></article>
        <article className="card stat-card"><span className="stat-label">Interviews</span><strong className="stat-value">{counts.interview}</strong><span className="stat-footnote">Marked by you</span></article>
      </div>

      <section className="card card-padding">
        <div className="page-heading" style={{ marginBottom: 14 }}>
          <div><h2 className="card-title">Tracked opportunities</h2><p className="card-description">Use the status control to record your own progress.</p></div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
        {loading ? <p className="empty-state">Loading your applications…</p> : applications.length === 0 ? (
          <div className="empty-state">
            No opportunities yet. Analyze a job from your dashboard or detect one with the extension.
            <div style={{ marginTop: 14 }}><Link className="button button-secondary" href="/dashboard">Find your first match</Link></div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="app-table">
              <thead><tr><th>Job</th><th>Match</th><th>Status</th><th>Last updated</th><th>Source</th></tr></thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id}>
                    <td><strong>{application.job.title}</strong><span>{application.job.company || 'Company not listed'} · {application.job.location || 'Location not listed'}</span></td>
                    <td>See match analysis</td>
                    <td>
                      <select
                        className="status-select"
                        aria-label={`Update status for ${application.job.title}`}
                        disabled={busyId === application.id}
                        value={application.status}
                        onChange={(event) => void changeStatus(application, event.target.value as ApplicationStatus)}
                      >
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                    <td>{new Date(application.updatedAt).toLocaleDateString()}</td>
                    <td>{application.job.platform || 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="notice" style={{ marginTop: 18 }}>
          Statuses are self-reported. “Submitted” is not proof that a job site received an application.
        </div>
      </section>
    </div>
  );
}
