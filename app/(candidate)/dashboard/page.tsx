'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  analyzeJob,
  createApplication,
  getApplications,
  getMatches,
  getProfile,
  getCandidateOnboarding,
  type CandidateProfile,
  type Job,
  type Match,
  type TrackedApplication,
  type OnboardingStatusResponse,
} from '../../../lib/api';

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  targetRole: '',
  location: '',
  skills: [],
  experienceYears: null,
};

const initialJob = {
  title: '',
  company: '',
  location: '',
  url: '',
  requiredSkills: '',
  experienceMin: '',
  description: '',
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const [jobForm, setJobForm] = useState(initialJob);
  const [latestMatch, setLatestMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadWorkspace() {
    setLoading(true);
    setError('');
    try {
      const [savedProfile, savedApplications, savedMatches, savedOnboarding] = await Promise.all([
        getProfile().catch(() => null),
        getApplications().catch(() => []),
        getMatches().catch(() => []),
        getCandidateOnboarding().catch(() => null),
      ]);
      setProfile(savedProfile || emptyProfile);
      setApplications(savedApplications || []);
      setMatches(savedMatches || []);
      setOnboardingStatus(savedOnboarding);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  function updateJobForm(key: keyof typeof initialJob, value: string) {
    setJobForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await analyzeJob({
        title: jobForm.title,
        company: jobForm.company,
        location: jobForm.location,
        url: jobForm.url,
        description: jobForm.description,
        platform: 'manual',
        requiredSkills: jobForm.requiredSkills.split(',').map((skill) => skill.trim()).filter(Boolean),
        experienceMin: jobForm.experienceMin === '' ? null : Number(jobForm.experienceMin),
      });
      setLatestMatch(result);
      setMatches((current) => [result, ...current.filter((match) => match.job.url !== result.job.url)]);
      setNotice('Match saved. This score reflects the information you entered; it is not a hiring probability.');
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : 'Could not analyze this job.');
    } finally {
      setBusy(false);
    }
  }

  async function trackJob(job: Job) {
    setBusy(true);
    setError('');
    try {
      await createApplication(job.id);
      setApplications(await getApplications());
      setNotice('Job added to your tracker as discovered. This does not mean you applied.');
    } catch (trackError) {
      setError(trackError instanceof Error ? trackError.message : 'Could not add this job to the tracker.');
    } finally {
      setBusy(false);
    }
  }

  const completenessScore = onboardingStatus?.completeness?.score ?? 0;
  const missingFields = onboardingStatus?.completeness?.missingFields ?? [];
  const extensionConnected = Boolean(onboardingStatus?.extensionConnected);
  const activeResumeCount = onboardingStatus?.activeResumeCount ?? 0;

  return (
    <div>
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR JOB SEARCH, IN ONE PLACE</p>
          <h1>Good to see you{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}.</h1>
          <p>Understand job fit, prepare carefully, and keep your search organized.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="button button-secondary" href="/onboarding">
            ✦ Onboarding wizard
          </Link>
          <Link className="button button-secondary" href="/candidate-profile">
            Edit career profile
          </Link>
        </div>
      </header>

      {/* Onboarding & Missing Fields Alert Banner */}
      {missingFields.length > 0 && (
        <section
          className="card card-padding"
          style={{
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, rgb(var(--info-container)) 0%, rgb(var(--surface-subtle)) 100%)',
            border: '1px solid rgb(var(--info) / 0.3)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong style={{ color: 'rgb(var(--info))', fontSize: '14px' }}>
                Profile Completeness: {completenessScore}% · Keep your profile accurate
              </strong>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgb(var(--on-surface-variant))' }}>
                Adding <strong>{missingFields.slice(0, 3).join(', ')}</strong> improves job fit scoring and auto-fill accuracy.
              </p>
            </div>
            <Link className="button button-primary" href="/onboarding">
              Complete profile in wizard →
            </Link>
          </div>
        </section>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <article className="card stat-card">
          <span className="stat-label">Tracked opportunities</span>
          <strong className="stat-value">{applications.length}</strong>
          <span className="stat-footnote">Across your workspace</span>
        </article>

        <article className="card stat-card">
          <span className="stat-label">Jobs analyzed</span>
          <strong className="stat-value">{matches.length}</strong>
          <span className="stat-footnote">Explanations saved to workspace</span>
        </article>

        <article className="card stat-card">
          <span className="stat-label">Profile completeness</span>
          <strong className="stat-value" style={{ color: completenessScore >= 80 ? 'rgb(var(--success))' : 'rgb(var(--info))' }}>
            {completenessScore}%
          </strong>
          <span className="stat-footnote">
            {completenessScore >= 80 ? 'Well detailed' : `${missingFields.length} recommended fields`}
          </span>
        </article>

        <article className="card stat-card">
          <span className="stat-label">Extension connection</span>
          <strong className="stat-value text-base" style={{ color: extensionConnected ? 'rgb(var(--success))' : 'rgb(var(--warning))' }}>
            {extensionConnected ? '● Connected' : '○ Pair required'}
          </strong>
          <span className="stat-footnote">
            {activeResumeCount > 0 ? `${activeResumeCount} active resume(s)` : 'No active resume'}
          </span>
        </article>
      </div>

      <div className="content-grid">
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: 16 }}>
            <div>
              <p className="eyebrow">JOB INTELLIGENCE</p>
              <h2 className="card-title">Check a job match</h2>
              <p className="card-description">Paste a job URL or enter the details yourself. Nothing is submitted.</p>
            </div>
          </div>
          <form onSubmit={(event) => void handleAnalyze(event)}>
            <div className="form-grid">
              <label className="field">
                Job title
                <input
                  required
                  maxLength={200}
                  value={jobForm.title}
                  onChange={(event) => updateJobForm('title', event.target.value)}
                  placeholder="Python Developer"
                />
              </label>
              <label className="field">
                Company
                <input
                  value={jobForm.company}
                  onChange={(event) => updateJobForm('company', event.target.value)}
                  placeholder="Company name"
                />
              </label>
              <label className="field">
                Location
                <input
                  value={jobForm.location}
                  onChange={(event) => updateJobForm('location', event.target.value)}
                  placeholder="Remote, Delhi…"
                />
              </label>
              <label className="field">
                Job URL
                <input
                  type="url"
                  required
                  value={jobForm.url}
                  onChange={(event) => updateJobForm('url', event.target.value)}
                  placeholder="https://company.example/jobs/…"
                />
              </label>
              <label className="field field-full">
                Skills mentioned in the job, comma separated
                <input
                  value={jobForm.requiredSkills}
                  onChange={(event) => updateJobForm('requiredSkills', event.target.value)}
                  placeholder="Python, SQL, FastAPI"
                />
                <span className="card-description">
                  Mentioned skills are compared with your profile; they are not treated as mandatory criteria.
                </span>
              </label>
              <label className="field">
                Minimum years of experience
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="0.5"
                  value={jobForm.experienceMin}
                  onChange={(event) => updateJobForm('experienceMin', event.target.value)}
                  placeholder="Not specified"
                />
              </label>
              <label className="field field-full">
                Job description
                <textarea
                  value={jobForm.description}
                  onChange={(event) => updateJobForm('description', event.target.value)}
                  placeholder="Paste the job description to keep it with your analysis."
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="button button-primary" disabled={busy}>
                {busy ? 'Analyzing…' : 'Analyze job fit'}
              </button>
              <span className="card-description">Simple average of available signals · no AI provider configured</span>
            </div>
          </form>

          {latestMatch && (
            <div className="match-result">
              <div className="match-result-header">
                <strong>
                  {latestMatch.job.title} · {latestMatch.job.company || 'Company not listed'}
                </strong>
                <span className="score-large">{latestMatch.score}%</span>
              </div>
              <span className="card-description">Match score only—not a probability of being hired.</span>
              <ul>
                {latestMatch.explanation.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
              {latestMatch.blockers.map((blocker) => (
                <div className="notice" key={blocker}>
                  Blocker: {blocker}
                </div>
              ))}
              {latestMatch.unknowns.map((unknown) => (
                <div className="notice" key={unknown}>
                  Needs review: {unknown}
                </div>
              ))}
              {latestMatch.evidence.map((item) => (
                <span className="card-description" key={item}>
                  Evidence: {item}
                </span>
              ))}
              {latestMatch.missingEvidence.map((item) => (
                <span className="card-description" key={item}>
                  Missing information: {item}
                </span>
              ))}
              <div>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void trackJob(latestMatch.job)}
                >
                  Add to application tracker
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-success" role="status">
              {notice}
            </p>
          )}
        </section>

        <aside className="card card-padding">
          <p className="eyebrow">YOUR SEARCH</p>
          <h2 className="card-title">Recent matches</h2>
          {loading ? (
            <p className="empty-state">Loading your workspace…</p>
          ) : matches.length === 0 ? (
            <p className="empty-state">No matches yet. Analyze a job to get a transparent, evidence-based breakdown.</p>
          ) : (
            matches.slice(0, 5).map((match) => (
              <div className="list-row" key={match.id}>
                <div className="list-row-main">
                  <strong>{match.job.title}</strong>
                  <span>
                    {match.job.company || 'Company not listed'} · {match.job.location || 'Location not listed'}
                  </span>
                </div>
                <span className="score-chip">{match.score}%</span>
              </div>
            ))
          )}
          <div className="notice" style={{ marginTop: 16 }}>
            Scores use only the profile and job details you provide. Missing information is shown as unknown—not assumed.
          </div>
        </aside>
      </div>

      <section className="card card-padding" style={{ marginTop: 16 }}>
        <p className="eyebrow">APPLICATION TRACKER</p>
        <div className="page-heading" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="card-title">Keep your next steps visible</h2>
            <p className="card-description">Applications stay in “discovered” until you update their status yourself.</p>
          </div>
          <Link className="button button-secondary" href="/application-tracker">
            Open tracker
          </Link>
        </div>
        {loading ? (
          <p className="empty-state">Loading applications…</p>
        ) : applications.length === 0 ? (
          <p className="empty-state">Your tracker is ready. Save a job after analyzing it to get started.</p>
        ) : (
          applications.slice(0, 3).map((application) => (
            <div className="list-row" key={application.id}>
              <div className="list-row-main">
                <strong>{application.job.title}</strong>
                <span>
                  {application.job.company || 'Company not listed'} · Updated{' '}
                  {new Date(application.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <span className="score-chip min-w-[90px]">
                {application.status}
              </span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
