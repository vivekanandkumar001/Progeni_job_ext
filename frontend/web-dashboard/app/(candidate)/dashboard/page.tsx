'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock as CalendarIcon,
  CircleDashed,
  ClipboardList,
  Compass as CompassIcon,
  FileText,
  Gauge,
  Link2,
  Plus,
  ScanSearch,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
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

const statusTone: Record<string, string> = {
  discovered: 'bg-surface-variant text-on-surface-variant',
  applied: 'bg-info-container text-on-info-container',
  interview: 'bg-warning-container text-on-warning-container',
  offer: 'bg-success-container text-on-success-container',
  rejected: 'bg-danger-container text-on-danger-container',
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
        requiredSkills: jobForm.requiredSkills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
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
  const firstName = profile.fullName ? profile.fullName.split(' ')[0] : '';

  const stats = [
    {
      label: 'Tracked opportunities',
      value: String(applications.length),
      footnote: 'Across your workspace',
      icon: BriefcaseBusiness,
      tone: 'text-primary bg-primary-container',
    },
    {
      label: 'Jobs analyzed',
      value: String(matches.length),
      footnote: 'Explanations saved',
      icon: ScanSearch,
      tone: 'text-secondary bg-secondary-container',
    },
    {
      label: 'Profile completeness',
      value: `${completenessScore}%`,
      footnote: completenessScore >= 80 ? 'Well detailed' : `${missingFields.length} recommended fields`,
      icon: Gauge,
      tone: completenessScore >= 80 ? 'text-success bg-success-container' : 'text-info bg-info-container',
    },
    {
      label: 'Extension connection',
      value: extensionConnected ? 'Connected' : 'Pair required',
      footnote: activeResumeCount > 0 ? `${activeResumeCount} active resume(s)` : 'No active resume',
      icon: Link2,
      tone: extensionConnected ? 'text-success bg-success-container' : 'text-warning bg-warning-container',
    },
  ];

  return (
    <div className="animate-rise space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-outline-variant bg-surface p-6 shadow-soft sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-secondary/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-subtle px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              <Sparkles className="h-3 w-3 text-primary" />
              Your job search, in one place
            </div>
            <h1 className="text-[26px] font-extrabold leading-[1.12] tracking-tight sm:text-[32px]">
              Good to see you{firstName ? `, ${firstName}` : ''}.
              <span className="block text-on-surface-variant/90">
                Understand fit. Prepare carefully. Stay organized.
              </span>
            </h1>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-on-surface-variant sm:text-sm">
              Progeni compares only the details you confirm. Every score is explainable, every gap is
              visible, and nothing is ever submitted without you.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="button button-secondary" href="/onboarding">
              <Sparkles className="h-4 w-4" />
              Onboarding wizard
            </Link>
            <Link className="button button-primary" href="/candidate-profile">
              Edit career profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Completeness banner */}
      {missingFields.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-info/25 bg-gradient-to-r from-info-container/80 to-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-on-surface">
                  Profile completeness {completenessScore}%
                </span>
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-variant">
                  <span
                    className="block h-full rounded-full bg-info transition-all"
                    style={{ width: `${Math.min(100, completenessScore)}%` }}
                  />
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                Adding <strong className="font-semibold text-on-surface">{missingFields.slice(0, 3).join(', ')}</strong>{' '}
                improves match scoring and auto-fill accuracy.
              </p>
            </div>
          </div>
          <Link className="button button-secondary button-sm shrink-0" href="/onboarding">
            Finish setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      )}

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="card stat-card" key={stat.label}>
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <span className="stat-label">{stat.label}</span>
                  <strong className="stat-value">{stat.value}</strong>
                  <span className="stat-footnote">{stat.footnote}</span>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.9} />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="content-grid">
        {/* Job analyzer */}
        <section className="card card-padding">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Job intelligence</p>
              <h2 className="card-title">Check a job match</h2>
              <p className="card-description">
                Paste a job URL or enter the details yourself. Nothing is submitted.
              </p>
            </div>
            <span className="chip">
              <CircleDashed className="h-3 w-3" />
              Evidence based
            </span>
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
                <span className="text-[11px] font-normal leading-relaxed text-on-surface-variant">
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
                <Target className="h-4 w-4" />
                {busy ? 'Analyzing…' : 'Analyze job fit'}
              </button>
              <span className="text-[11px] text-on-surface-variant">
                Simple average of available signals · no AI provider configured
              </span>
            </div>
          </form>

          {latestMatch && (
            <div className="match-result">
              <div className="match-result-header">
                <div>
                  <strong>
                    {latestMatch.job.title} · {latestMatch.job.company || 'Company not listed'}
                  </strong>
                  <span className="mt-1 block text-[11px] text-on-surface-variant">
                    Match score only — not a probability of being hired.
                  </span>
                </div>
                <span className="score-large">{latestMatch.score}%</span>
              </div>
              <ul>
                {latestMatch.explanation.map((line, index) => (
                  <li key={`${index}-${line}`}>{line}</li>
                ))}
              </ul>
              {latestMatch.blockers.map((blocker) => (
                <div className="notice" key={blocker}>
                  <strong className="font-semibold">Blocker:</strong> {blocker}
                </div>
              ))}
              {latestMatch.unknowns.map((unknown) => (
                <div className="notice" key={unknown}>
                  <strong className="font-semibold">Needs review:</strong> {unknown}
                </div>
              ))}
              {latestMatch.evidence.map((item) => (
                <span className="text-[11.5px] text-on-surface-variant" key={item}>
                  Evidence: {item}
                </span>
              ))}
              {latestMatch.missingEvidence.map((item) => (
                <span className="text-[11.5px] text-on-surface-variant" key={item}>
                  Missing information: {item}
                </span>
              ))}
              <div>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void trackJob(latestMatch.job)}
                >
                  <Plus className="h-4 w-4" />
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

        {/* Recent matches */}
        <aside className="card card-padding">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Your search</p>
              <h2 className="card-title">Recent matches</h2>
            </div>
            <Link
              href="/job-match-intelligence"
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant hover:text-on-surface"
              aria-label="Open match intelligence"
            >
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <div className="mt-4 space-y-2">
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
              <div className="skeleton h-12 w-full" />
            </div>
          ) : matches.length === 0 ? (
            <p className="empty-state">
              No matches yet. Analyze a job to get a transparent, evidence-based breakdown.
            </p>
          ) : (
            matches.slice(0, 5).map((match) => (
              <div className="list-row" key={match.id}>
                <div className="list-row-main">
                  <strong>{match.job.title}</strong>
                  <span>
                    {match.job.company || 'Company not listed'} ·{' '}
                    {match.job.location || 'Location not listed'}
                  </span>
                </div>
                <span className="score-chip">{match.score}%</span>
              </div>
            ))
          )}
          <div className="notice mt-4">
            Scores use only the profile and job details you provide. Missing information is shown as
            unknown — not assumed.
          </div>
        </aside>
      </div>

      {/* Tracker */}
      <section className="card card-padding">
        <div className="page-heading mb-2 items-start">
          <div>
            <p className="eyebrow">Application tracker</p>
            <h2 className="card-title">Keep your next steps visible</h2>
            <p className="card-description">
              Applications stay in “discovered” until you update their status yourself.
            </p>
          </div>
          <Link className="button button-secondary button-sm" href="/application-tracker">
            Open tracker
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {loading ? (
          <p className="empty-state">Loading applications…</p>
        ) : applications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-variant text-on-surface-variant">
              <ClipboardList className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium text-on-surface">Your tracker is ready</p>
            <p className="max-w-sm text-xs text-on-surface-variant">
              Save a job after analyzing it to start building your pipeline.
            </p>
          </div>
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
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${
                  statusTone[application.status] ?? 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                {application.status}
              </span>
            </div>
          ))
        )}
      </section>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: '/resume-analyzer', label: 'ATS diagnostics', copy: 'Find what blocks parsing.', icon: FileText },
          { href: '/job-recommendations', label: 'Discover jobs', copy: 'Explore matching roles.', icon: CompassIcon },
          { href: '/interview-center', label: 'Interview center', copy: 'Prepare with your evidence.', icon: CalendarIcon },
          { href: '/performance-analytics', label: 'Search analytics', copy: 'See rates and momentum.', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="card group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-on-surface">{item.label}</span>
                <span className="block truncate text-[11px] text-on-surface-variant">{item.copy}</span>
              </span>
              <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-on-surface-variant/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
