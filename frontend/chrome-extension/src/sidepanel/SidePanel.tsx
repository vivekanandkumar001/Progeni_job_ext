import React, { useEffect, useState } from 'react';
import {
  DETECTED_JOB_STORAGE_KEY,
  ensureSupabaseHostPermission,
  makeRequestId,
  sendMessage,
  sendTabMessage,
} from '../shared/messages';

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
  authenticated?: boolean;
  local?: boolean;
  confirmationRequired?: boolean;
  email?: string;
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

function isJob(value: unknown): value is Job {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.id === undefined || typeof candidate.id === 'string') &&
    typeof candidate.title === 'string' &&
    typeof candidate.company === 'string' &&
    typeof candidate.location === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.platform === 'string' &&
    Array.isArray(candidate.requiredSkills) &&
    candidate.requiredSkills.every((skill) => typeof skill === 'string') &&
    (candidate.experienceMin === null || typeof candidate.experienceMin === 'number')
  );
}

export default function SidePanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authMethod, setAuthMethod] = useState<'password' | 'pairing'>('password');
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [skillsText, setSkillsText] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [autofillFields, setAutofillFields] = useState<
    Array<{ id: string; name: string; label: string; selector: string; value: string; approved: boolean; required: boolean }>
  >([]);
  const [humanApproved, setHumanApproved] = useState(false);
  const [autofillNotice, setAutofillNotice] = useState('');
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);

  useEffect(() => {
    void loadConsent();
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      const detectedJob = changes[DETECTED_JOB_STORAGE_KEY]?.newValue;
      if (areaName === 'session' && isJob(detectedJob)) {
        setJob(detectedJob);
        setStatus('Detected details. Review them before calculating your match.');
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  async function loadConsent() {
    setBusy(true);
    try {
      const auth = await sendMessage<ResponseData>({ type: 'GET_AUTH_STATE' });
      if (!auth.ok) throw new Error(auth.error || 'Could not check your account sign-in.');
      setAuthenticated(auth.authenticated === true);
      setLocalMode(auth.local === true);
      if (!auth.authenticated) {
        setConsent(null);
        setStatus('');
        return;
      }
      const result = await sendMessage<ResponseData>({ type: 'GET_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not check the privacy notice.');
      setConsent(result.accepted === true);
      if (result.accepted) await loadWorkspace();
    } catch (error) {
      setConsent(null);
      setStatus(error instanceof Error ? error.message : 'The Progeni workspace is unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      await ensureSupabaseHostPermission();
      const result = await sendMessage<ResponseData>({
        type: authMode === 'sign-up' ? 'SIGN_UP' : 'SIGN_IN',
        email: email.trim(),
        password,
      });
      if (!result.ok) throw new Error(result.error || 'Could not authenticate your account.');
      if (result.confirmationRequired) {
        setStatus('Check your email to confirm your account, then sign in.');
        return;
      }
      setAuthenticated(result.authenticated === true);
      if (result.authenticated) await loadConsent();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function leaveAccount() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SIGN_OUT' });
      if (!result.ok) throw new Error(result.error || 'Could not sign out.');
      setAuthenticated(false);
      setConsent(null);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not sign out.');
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
    const detectedJobResult = await sendMessage<ResponseData>({ type: 'GET_DETECTED_JOB' });
    if (!detectedJobResult.ok) {
      throw new Error(detectedJobResult.error || 'Could not load the detected job.');
    }
    if (isJob(detectedJobResult.job)) setJob(detectedJobResult.job);
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'SAVE_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not save your consent.');
      setConsent(true);
      await loadWorkspace();
      setStatus('Privacy notice accepted.');
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
      setStatus('Profile saved to your workspace.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function importDetectedJob() {
    if (!job) return;
    setBusy(true);
    setStatus('');
    try {
      const result = await sendMessage<ResponseData>({
        type: 'IMPORT_JOB',
        payload: {
          title: job.title,
          companyName: job.company,
          location: job.location,
          url: job.url,
          provider: 'extension',
          skills: job.requiredSkills,
        },
      });
      if (!result.ok) throw new Error(result.error || 'Failed to import job');
      setStatus('Job imported and synced with your candidate dashboard.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not import job');
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

  async function generateCoverLetter() {
    if (!job) return;
    setBusy(true);
    setStatus('Generating cover letter…');
    try {
      const result = await sendMessage<any>({
        type: 'GENERATE_COVER_LETTER',
        payload: { job },
      });
      if (result.ok && result.coverLetter) {
        setCoverLetter(result.coverLetter);
        setStatus('Cover letter generated successfully!');
      } else {
        setStatus(result.error || 'Failed to generate cover letter.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Cover letter generation failed.');
      console.error('Cover letter generation error:', error);
    } finally {
      setBusy(false);
    }
  }

  function toggleCoverLetterVisibility() {
    setShowCoverLetter(!showCoverLetter);
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

  async function submitPairing(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const result = await sendMessage<ResponseData>({
        type: 'PAIR_WITH_CODE',
        code: pairingCodeInput.trim().toUpperCase(),
      });
      if (!result.ok) throw new Error(result.error || 'Failed to redeem pairing code.');
      setAuthenticated(true);
      setStatus('Extension linked successfully to your dashboard workspace.');
      await loadWorkspace();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Invalid or expired pairing code.');
    } finally {
      setBusy(false);
    }
  }

  async function detectFormFields() {
    setBusy(true);
    setAutofillNotice('');
    try {
      const activeTab = await sendMessage<ResponseData & { url?: string; tabId?: number }>({
        type: 'GET_ACTIVE_TAB',
      });
      if (!activeTab.ok || activeTab.tabId === undefined) {
        throw new Error('Please open an application page in the active tab.');
      }
      setActiveTabId(activeTab.tabId);
      const res = await sendTabMessage<{ ok?: boolean; error?: string; plan?: { fields: any[] } }>(
        activeTab.tabId,
        {
          type: 'PREVIEW_AUTOFILL',
          payload: {
            candidateData: {
              fullName: profile.fullName,
              email: profile.email,
              phone: profile.phone,
              location: profile.location,
            },
            isApplicationApproved: humanApproved,
          },
        },
      );
      if (!res.ok || !res.plan) {
        throw new Error(res.error || 'Could not detect form fields on this page.');
      }
      setAutofillFields(res.plan.fields || []);
      setAutofillNotice(`Detected ${res.plan.fields.length} form fields. Review each field before injecting.`);
    } catch (err: any) {
      setAutofillNotice(err.message || 'Form detection failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggleFieldApproval(id: string) {
    setAutofillFields((current) =>
      current.map((f) => (f.id === id ? { ...f, approved: !f.approved } : f)),
    );
  }

  function approveAllFields() {
    setAutofillFields((current) => current.map((f) => ({ ...f, approved: true })));
  }

  async function executeAutofill() {
    if (!humanApproved) {
      setAutofillNotice('Safety invariant: Explicit candidate approval is required before autofill can inject values.');
      return;
    }
    const approvedCount = autofillFields.filter((f) => f.approved).length;
    if (approvedCount === 0) {
      setAutofillNotice('Select at least one approved field to inject.');
      return;
    }
    if (activeTabId === null) {
      setAutofillNotice('Active tab is disconnected. Rescan the form.');
      return;
    }
    setBusy(true);
    setAutofillNotice('');
    try {
      const res = await sendTabMessage<{ ok?: boolean; injectedCount?: number; skippedCount?: number; message?: string }>(
        activeTabId,
        {
          type: 'APPLY_AUTOFILL',
          payload: {
            plan: {
              fields: autofillFields,
              isApplicationApproved: true,
            },
          },
        },
      );
      if (!res.ok) {
        throw new Error(res.message || 'Autofill execution failed.');
      }
      setAutofillNotice(`Successfully injected ${res.injectedCount || 0} approved fields into the form. Review the inputs and submit manually.`);
    } catch (err: any) {
      setAutofillNotice(err.message || 'Autofill injection failed.');
    } finally {
      setBusy(false);
    }
  }

  function updateProfile<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  if (authenticated === null) {
    return (
      <main className="sidepanel">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <strong>Progeni AutoApply</strong>
            <span>Connecting to your workspace…</span>
          </div>
        </header>
        <section className="card">
          <div className="empty-note">Connecting to your Progeni account…</div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="sidepanel">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <strong>Progeni AutoApply</strong>
            <span>Sign in to your career workspace</span>
          </div>
          <span className="brand-badge">SECURE</span>
        </header>

        <section className="card">
          <p className="eyebrow">Access</p>
          <h1>Connect your account</h1>
          <p>Sign in with email, or link this extension using a pairing code from your dashboard.</p>

          <div className="segmented" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'password'}
              className={authMethod === 'password' ? 'active' : ''}
              onClick={() => {
                setAuthMethod('password');
                setStatus('');
              }}
            >
              Email sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMethod === 'pairing'}
              className={authMethod === 'pairing' ? 'active' : ''}
              onClick={() => {
                setAuthMethod('pairing');
                setStatus('');
              }}
            >
              Pair with code
            </button>
          </div>

          {authMethod === 'pairing' ? (
            <div>
              <p className="muted">
                Open your Progeni dashboard → <b>Settings → Chrome extension pairing</b> and paste the
                6-digit code below.
              </p>
              <form className="form-grid" onSubmit={(event) => void submitPairing(event)}>
                <label className="full-width">
                  Pairing code
                  <input
                    type="text"
                    required
                    placeholder="PAIR-123456"
                    value={pairingCodeInput}
                    onChange={(event) => setPairingCodeInput(event.target.value)}
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                    }}
                  />
                </label>
                <button className="primary full-width" disabled={busy || !pairingCodeInput}>
                  {busy ? 'Linking…' : 'Link extension'}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="segmented" role="tablist" aria-label="Account mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'sign-in'}
                  className={authMode === 'sign-in' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('sign-in');
                    setStatus('');
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'sign-up'}
                  className={authMode === 'sign-up' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('sign-up');
                    setStatus('');
                  }}
                >
                  Create account
                </button>
              </div>
              <form className="form-grid" onSubmit={(event) => void submitAuth(event)}>
                <label className="full-width">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="full-width">
                  Password
                  <input
                    type="password"
                    autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                  />
                </label>
                <button className="primary full-width" disabled={busy}>
                  {busy ? 'Please wait…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            </>
          )}

          {status && (
            <p className="status" role="status">
              {status}
            </p>
          )}
        </section>
      </main>
    );
  }

  if (consent !== true) {
    return (
      <main className="sidepanel">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <strong>Progeni AutoApply</strong>
            <span>{localMode ? 'Local career workspace' : 'Account career workspace'}</span>
          </div>
        </header>

        <section className="card card-hero">
          <span className="pill">
            <span className="pill-dot" />
            Privacy first
          </span>
          <h1 style={{ marginTop: 10 }}>Privacy notice</h1>
          <p>
            Your profile, detected job details, match results, and tracker are stored
            {localMode
              ? ' on this device by the local backend.'
              : ' in the Progeni workspace linked to your account.'}{' '}
            Job pages are read only after you click Detect. No data is sent to an AI provider or job site.
          </p>
          <p className="muted">
            Resume files are processed to suggest details; the original file and full text are not saved.
            Application submission remains manual.
          </p>
          <button
            className="primary"
            disabled={busy || consent === null}
            onClick={() => void acceptConsent()}
          >
            {busy ? 'Connecting…' : 'I agree and continue'}
          </button>
          {consent === null && (
            <button className="secondary" disabled={busy} onClick={() => void loadConsent()}>
              Retry connection
            </button>
          )}
          {status && (
            <p className="status" role="status">
              {status}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="sidepanel">
      <header className="brand">
        <div className="brand-mark">P</div>
        <div className="brand-text">
          <strong>Progeni AutoApply</strong>
          <span>Candidate workspace · {localMode ? 'local' : 'account'}</span>
        </div>
        <span className="brand-badge">
          <span className="pill-dot" />
          {localMode ? 'LOCAL' : 'LIVE'}
        </span>
      </header>

      {/* Profile */}
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your truth base</p>
            <h1>Career profile</h1>
            <p>Only used to explain job fit.</p>
          </div>
          <span className="local-badge">{localMode ? 'LOCAL' : 'ACCOUNT'}</span>
        </div>
        <form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
          <label>
            Full name
            <input
              value={profile.fullName}
              onChange={(event) => updateProfile('fullName', event.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={profile.email}
              onChange={(event) => updateProfile('email', event.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Phone
            <input
              value={profile.phone}
              onChange={(event) => updateProfile('phone', event.target.value)}
              autoComplete="tel"
            />
          </label>
          <label>
            Target role
            <input
              value={profile.targetRole}
              onChange={(event) => updateProfile('targetRole', event.target.value)}
            />
          </label>
          <label>
            Location
            <input
              value={profile.location}
              onChange={(event) => updateProfile('location', event.target.value)}
            />
          </label>
          <label>
            Years of experience
            <input
              type="number"
              min="0"
              max="80"
              step="0.5"
              value={profile.experienceYears ?? ''}
              onChange={(event) =>
                updateProfile(
                  'experienceYears',
                  event.target.value === '' ? null : Number(event.target.value),
                )
              }
            />
          </label>
          <label className="full-width">
            Skills, comma separated
            <input
              value={skillsText}
              onChange={(event) => setSkillsText(event.target.value)}
              placeholder="Python, SQL, FastAPI"
            />
          </label>
          <button className="primary full-width" disabled={busy}>
            Save profile
          </button>
        </form>
      </section>

      {/* Job intelligence */}
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Job intelligence</p>
            <h2>Analyze this job</h2>
            <p>Extract only after your click.</p>
          </div>
        </div>
        <button className="primary" disabled={busy} onClick={() => void detectJob()}>
          {busy ? 'Working…' : 'Detect job on current tab'}
        </button>

        {job && (
          <div className="job-preview">
            <strong>{job.title || 'Untitled job'}</strong>
            <span>{[job.company, job.location, job.platform].filter(Boolean).join(' · ')}</span>
            <span>
              {job.requiredSkills.length
                ? `Detected skills: ${job.requiredSkills.join(', ')}`
                : 'No recognizable skills found; verify requirements manually.'}
            </span>
            <div className="button-row">
              <button className="secondary" disabled={busy} onClick={() => void analyzeJob()}>
                Calculate match
              </button>
              <button className="secondary" disabled={busy} onClick={() => void generateCoverLetter()}>
                Cover letter
              </button>
              <button
                className="secondary full-width"
                disabled={busy}
                onClick={() => void importDetectedJob()}
              >
                Import to discovery
              </button>
            </div>
          </div>
        )}

        {match && (
          <div className="match-score-card">
            <div className="score-ring">
              <div
                className="score"
                style={{ '--score': match.score } as unknown as React.CSSProperties}
              >
                {match.score}
              </div>
              <div>
                <strong>Match score {match.score}%</strong>
                <p>Fit score, not a hiring probability.</p>
              </div>
            </div>
            <ul>
              {match.explanation.map((item, index) => (
                <li key={`${index}-${item}`}>{item}</li>
              ))}
            </ul>
            {match.blockers.map((item) => (
              <p className="warning" key={item}>
                {item}
              </p>
            ))}
            {match.unknowns.map((item) => (
              <p className="warning" key={item}>
                Needs review: {item}
              </p>
            ))}
            {match.evidence.map((item) => (
              <p className="muted" key={item}>
                Evidence: {item}
              </p>
            ))}
            {match.missingEvidence.map((item) => (
              <p className="muted" key={item}>
                Missing evidence: {item}
              </p>
            ))}
            {job?.id && (
              <button className="secondary" disabled={busy} onClick={() => void trackJob()}>
                Add job to tracker
              </button>
            )}
          </div>
        )}

        {coverLetter && (
          <div className="cover-letter-card">
            <div className="section-heading" style={{ marginBottom: 0 }}>
              <h3>Generated cover letter</h3>
              <button
                type="button"
                className="ghost"
                style={{ width: 'auto', margin: 0, padding: '4px 8px', minHeight: 28 }}
                onClick={() => {
                  const textArea = document.createElement('textarea');
                  textArea.value = coverLetter;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  setStatus('Cover letter copied to clipboard.');
                }}
              >
                Copy
              </button>
            </div>
            <p>{coverLetter}</p>
            {showCoverLetter && <p className="muted">Review and personalize before sending.</p>}
            <button
              type="button"
              className="ghost"
              style={{ marginTop: 6 }}
              onClick={toggleCoverLetterVisibility}
            >
              {showCoverLetter ? 'Hide note' : 'Show review note'}
            </button>
          </div>
        )}
      </section>

      {/* Autofill assistant */}
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Application assistant</p>
            <h2>Safe form population</h2>
            <p>Explicit candidate approval required before injection.</p>
          </div>
        </div>
        <button className="primary" disabled={busy} onClick={() => void detectFormFields()}>
          {busy ? 'Scanning…' : 'Scan application form'}
        </button>

        {autofillFields.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                Detected fields ({autofillFields.length})
              </span>
              <button
                type="button"
                className="ghost"
                style={{ width: 'auto', margin: 0, padding: '3px 8px', minHeight: 26 }}
                onClick={() => approveAllFields()}
              >
                Approve all
              </button>
            </div>

            <div className="fields-list">
              {autofillFields.map((f) => (
                <div className="field-row" key={f.id}>
                  <input
                    type="checkbox"
                    checked={f.approved}
                    onChange={() => toggleFieldApproval(f.id)}
                    id={`field_${f.id}`}
                  />
                  <label htmlFor={`field_${f.id}`}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                      {f.label} {f.required ? '*' : ''}
                    </span>
                    <span>
                      {f.value
                        ? `→ "${f.value.slice(0, 34)}${f.value.length > 34 ? '…' : ''}"`
                        : '(No mapped value)'}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <div className="approval-gate">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={humanApproved}
                  onChange={(event) => setHumanApproved(event.target.checked)}
                />
                <span>
                  <strong style={{ color: 'var(--ink)' }}>Explicit human approval gate:</strong> I have
                  reviewed the detected fields and approve populating them. Progeni never submits forms
                  or bypasses security checks.
                </span>
              </label>
            </div>

            <button
              className="primary full-width"
              style={{ marginTop: 10 }}
              disabled={busy || !humanApproved || autofillFields.filter((f) => f.approved).length === 0}
              onClick={() => void executeAutofill()}
            >
              Safely fill approved fields
            </button>
          </div>
        )}

        {autofillNotice && (
          <p className="status" style={{ marginTop: 8 }} role="status">
            {autofillNotice}
          </p>
        )}
      </section>

      {/* Tracker */}
      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>Application tracker</h2>
          </div>
          <span className="local-badge">{applications.length} SAVED</span>
        </div>
        {applications.length === 0 ? (
          <p className="empty-note">No jobs tracked yet. Detect a job and add it here.</p>
        ) : (
          applications.map((application) => (
            <div className="application-row" key={application.id}>
              <div>
                <strong>{application.job.title}</strong>
                <span>{application.job.company || 'Company not listed'}</span>
              </div>
              <select
                aria-label={`Status for ${application.job.title}`}
                disabled={busy}
                value={application.status}
                onChange={(event) => void updateStatus(application, event.target.value)}
              >
                {['discovered', 'prepared', 'submitted', 'interview', 'rejected', 'withdrawn'].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </div>
          ))
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          “Submitted” is a status you set yourself; Progeni does not submit applications.
        </p>
      </section>

      <button className="ghost" disabled={busy} onClick={() => void leaveAccount()}>
        Sign out of Progeni
      </button>
      <footer className="policy-note">
        Manual review and submission only. Never share passwords or one-time codes.
      </footer>
      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </main>
  );
}
