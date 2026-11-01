import React, { useEffect, useState } from 'react';
import { makeRequestId, sendMessage } from '../shared/messages';

interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  targetRole: string;
  location: string;
  skills: string[];
  experienceYears: number | null;
}

interface Job {
  id?: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  requiredSkills: string[];
  experienceMin: number | null;
}

interface Match {
  id: string;
  job: Job;
  score: number;
  factors: Record<string, number>;
  explanation: string[];
  missingEvidence: string[];
  eligible: boolean;
  blockers: string[];
  unknowns: string[];
  evidence: string[];
}

interface Application {
  id: string;
  job: Job;
  status: string;
  notes: string;
}

interface ResponseData {
  ok?: boolean;
  accepted?: boolean;
  profile?: CandidateProfile | null;
  applications?: Application[];
  application?: Application;
  match?: Match;
  status?: string;
  job?: Job;
  error?: string;
}

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  targetRole: '',
  location: '',
  skills: [],
  experienceYears: null,
};

export default function SidePanel() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [skillsText, setSkillsText] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void loadConsent();
  }, []);

  async function loadConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not check the local privacy notice.');
      setConsent(result.accepted === true);
      if (result.accepted) await loadWorkspace();
    } catch (error) {
      setConsent(null);
      setStatus(error instanceof Error ? error.message : 'Local backend is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function loadWorkspace() {
    const [profileResult, applicationResult] = await Promise.all([
      sendMessage<ResponseData>({ type: 'GET_CANDIDATE_PROFILE' }),
      sendMessage<ResponseData>({ type: 'GET_APPLICATIONS' }),
    ]);
    if (!profileResult.ok) throw new Error(profileResult.error || 'Could not load your profile.');
    if (!applicationResult.ok) {
      throw new Error(applicationResult.error || 'Could not load your application tracker.');
    }
    if (profileResult.profile) {
      setProfile(profileResult.profile);
      setSkillsText(profileResult.profile.skills.join(', '));
    }
    setApplications(applicationResult.applications || []);
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SAVE_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not save your consent.');
      setConsent(true);
      await loadWorkspace();
      setStatus('Privacy notice accepted on this device.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your consent.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const result = await sendMessage<ResponseData>({
        type: 'SAVE_PROFILE',
        payload: {
          ...profile,
          skills: skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
        },
      });
      if (!result.ok) throw new Error(result.error || 'Could not save your profile.');
      if (result.profile) setProfile(result.profile);
      setStatus('Profile saved on this device.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function detectJob() {
    setBusy(true);
    setStatus('');
    setMatch(null);
    try {
      const activeTab = await sendMessage<ResponseData & { url?: string; tabId?: number }>({
        type: 'GET_ACTIVE_TAB',
      });
      if (!activeTab.ok || !activeTab.url || activeTab.tabId === undefined) {
        throw new Error(activeTab.error || 'Open a job page before detecting a job.');
      }
      const result = await sendMessage<ResponseData>({
        type: 'DETECT_REQUEST',
        url: activeTab.url,
        tabId: activeTab.tabId,
        requestId: makeRequestId(),
      });
      if (!result.ok) throw new Error(result.error || 'Job detection failed.');
      if (result.status !== 'supported' || !result.job) {
        throw new Error('This page is not supported. Enter job details in the dashboard instead.');
      }
      setJob(result.job);
      setStatus('Detected details. Review them before calculating your match.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Job detection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function analyzeJob() {
    if (!job) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await sendMessage<ResponseData>({ type: 'ANALYZE_JOB', payload: job });
      if (!result.ok || !result.match) throw new Error(result.error || 'Could not calculate the match.');
      setMatch(result.match);
      setJob(result.match.job);
      setStatus('Match calculated from the information currently in your profile and this job page.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not calculate the match.');
    } finally {
      setBusy(false);
    }
  }

  async function trackJob() {
    if (!job?.id) return;
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({
        type: 'CREATE_APPLICATION',
        jobId: job.id,
      });
      if (!result.ok) throw new Error(result.error || 'Could not save this job to your tracker.');
      const list = await sendMessage<ResponseData>({ type: 'GET_APPLICATIONS' });
      if (!list.ok) throw new Error(list.error || 'The job was saved, but the tracker could not refresh.');
      setApplications(list.applications || []);
      setStatus('Job added to your tracker as discovered. This does not mean you applied.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this job.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(application: Application, nextStatus: string) {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({
        type: 'UPDATE_APPLICATION',
        id: application.id,
        status: nextStatus,
      });
      if (!result.ok) throw new Error(result.error || 'Could not update the application status.');
      const list = await sendMessage<ResponseData>({ type: 'GET_APPLICATIONS' });
      if (!list.ok) throw new Error(list.error || 'Could not refresh the tracker.');
      setApplications(list.applications || []);
      setStatus('Tracker status updated.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not update the application.');
    } finally {
      setBusy(false);
    }
  }

  function updateProfile<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  if (consent !== true) {
    return (
      <main className="sidepanel">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div><strong>Progeni AutoApply</strong><span>Local career workspace</span></div>
        </header>
        <section className="card">
          <h1>Privacy notice</h1>
          <p>
            Your profile, detected job details, match results, and tracker are stored on
            this device by the local backend. Job pages are read only after you click
            Detect. No data is sent to an AI provider or job site.
          </p>
          <p className="muted">The local data file is not encrypted by this development build; use a trusted device only. Application submission remains manual.</p>
          <button className="primary" disabled={busy || consent === null} onClick={() => void acceptConsent()}>
            {busy ? 'Connecting…' : 'I agree and continue'}
          </button>
          {consent === null && (
            <button className="secondary" disabled={busy} onClick={() => void loadConsent()}>
              Retry connection
            </button>
          )}
          {status && <p className="status" role="status">{status}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="sidepanel">
      <header className="brand">
        <div className="brand-mark">P</div>
        <div><strong>Progeni AutoApply</strong><span>Candidate workspace · local-only</span></div>
      </header>

      <section className="card">
        <div className="section-heading">
          <div><h1>Your career profile</h1><p>Only used to explain job fit.</p></div>
          <span className="local-badge">LOCAL</span>
        </div>
        <form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
          <label>Full name<input value={profile.fullName} onChange={(event) => updateProfile('fullName', event.target.value)} autoComplete="name" /></label>
          <label>Email<input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} autoComplete="email" /></label>
          <label>Phone<input value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} autoComplete="tel" /></label>
          <label>Target role<input value={profile.targetRole} onChange={(event) => updateProfile('targetRole', event.target.value)} /></label>
          <label>Location<input value={profile.location} onChange={(event) => updateProfile('location', event.target.value)} /></label>
          <label>Years of experience<input type="number" min="0" max="80" step="0.5" value={profile.experienceYears ?? ''} onChange={(event) => updateProfile('experienceYears', event.target.value === '' ? null : Number(event.target.value))} /></label>
          <label className="full-width">Skills, comma separated<input value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="Python, SQL, FastAPI" /></label>
          <button className="primary full-width" disabled={busy}>Save profile</button>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div><h2>Job intelligence</h2><p>Extract only after your click.</p></div>
        </div>
        <button className="primary" disabled={busy} onClick={() => void detectJob()}>
          Detect job on current tab
        </button>
        {job && (
          <div className="job-preview">
            <strong>{job.title || 'Untitled job'}</strong>
            <span>{[job.company, job.location, job.platform].filter(Boolean).join(' · ')}</span>
            <span>{job.requiredSkills.length ? `Detected skills: ${job.requiredSkills.join(', ')}` : 'No recognizable skills found; verify requirements manually.'}</span>
            <button className="secondary" disabled={busy} onClick={() => void analyzeJob()}>
              Calculate explainable match
            </button>
          </div>
        )}
        {match && (
          <div className="match-card">
            <div className="score">{match.score}<span>%</span></div>
            <p className="muted">Fit score, not a hiring probability.</p>
            <ul>{match.explanation.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
            {match.blockers.map((item) => <p className="warning" key={item}>{item}</p>)}
            {match.unknowns.map((item) => <p className="warning" key={item}>Needs review: {item}</p>)}
            {match.evidence.map((item) => <p className="muted" key={item}>Evidence: {item}</p>)}
            {match.missingEvidence.map((item) => <p className="muted" key={item}>Missing evidence: {item}</p>)}
            {job?.id && (
              <button className="secondary" disabled={busy} onClick={() => void trackJob()}>
                Add job to tracker
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Application tracker</h2>
        {applications.length === 0 ? (
          <p className="muted">No jobs tracked yet. Detect a job and add it here.</p>
        ) : applications.map((application) => (
          <div className="application-row" key={application.id}>
            <div><strong>{application.job.title}</strong><span>{application.job.company || 'Company not listed'}</span></div>
            <select
              aria-label={`Status for ${application.job.title}`}
              disabled={busy}
              value={application.status}
              onChange={(event) => void updateStatus(application, event.target.value)}
            >
              {['discovered', 'prepared', 'submitted', 'interview', 'rejected', 'withdrawn'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        ))}
        <p className="muted">“Submitted” is a status you set yourself; Progeni does not submit applications.</p>
      </section>

      <footer className="policy-note">
        Manual review and submission only. Never share passwords or one-time codes.
      </footer>
      {status && <p className="status" role="status">{status}</p>}
    </main>
  );
}
