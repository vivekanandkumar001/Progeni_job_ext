import React, { useEffect, useState } from 'react';
import { ensureSupabaseHostPermission, makeRequestId, sendMessage, sendTabMessage } from '../shared/messages';

interface ResponseData {
  ok?: boolean;
  accepted?: boolean;
  authenticated?: boolean;
  local?: boolean;
  confirmationRequired?: boolean;
  email?: string;
  supported?: boolean;
  status?: string;
  job?: { title?: string; company?: string };
  error?: string;
  skills?: string[];
  experience_years?: number | null;
}

type IconName =
  | 'radar'
  | 'sparkles'
  | 'shield'
  | 'wand'
  | 'copy'
  | 'external'
  | 'logout'
  | 'check'
  | 'alert'
  | 'panel'
  | 'search';

const iconPaths: Record<IconName, React.ReactNode> = {
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
      <path d="M18.5 15l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  wand: (
    <>
      <path d="M15 4V2M15 10V8M12.5 6h-2M17.5 6h2M18.4 3.6l1.4-1.4M18.4 8.4l1.4 1.4M11.6 3.6L10.2 2.2" />
      <path d="M3 21l9-9 2 2-9 9-2-2z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7" />
      <path d="M21 3l-9 9" />
      <path d="M21 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9.5 17H2.5L12 3z" />
      <path d="M12 9v5M12 17.5v.5" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
};

function Icon({ name, className = 'icon' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {iconPaths[name]}
    </svg>
  );
}

export default function Popup() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [localMode, setLocalMode] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [job, setJob] = useState<ResponseData['job'] | null>(null);
  const [matchScore, setMatchScore] = useState<{
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    explanation: string[];
  } | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [smartApplyResult, setSmartApplyResult] = useState<{
    ok: boolean;
    injectedCount: number;
    skippedCount: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    void refreshAuth();
  }, []);

  async function refreshAuth() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_AUTH_STATE' });
      if (!result.ok) throw new Error(result.error || 'Could not check your account sign-in.');
      setAuthenticated(result.authenticated === true);
      setLocalMode(result.local === true);
      setStatus('');
      if (result.authenticated) await refreshConsent();
    } catch (error) {
      setAuthenticated(false);
      setStatus(error instanceof Error ? error.message : 'Could not connect to your account.');
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
      if (result.authenticated) await refreshConsent();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not authenticate your account.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshConsent() {
    setBusy(true);
    try {
      const result = await sendMessage<ResponseData>({ type: 'GET_CONSENT' });
      if (!result.ok) throw new Error(result.error || 'Could not check the privacy notice.');
      setConsent(result.accepted === true);
      setStatus('');
    } catch (error) {
      setConsent(null);
      setStatus(error instanceof Error ? error.message : 'The Progeni workspace is unavailable.');
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
      setStatus('Privacy notice accepted.');
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
    setMatchScore(null);
    setCoverLetter(null);
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

      if (result.job && authenticated) {
        try {
          const profileResult = await sendMessage<ResponseData>({ type: 'GET_PROFILE_SKILLS' });
          if (profileResult.ok && profileResult.skills) {
            const expResult = await sendMessage<ResponseData>({ type: 'GET_PROFILE_EXPERIENCE' });
            const candExp =
              Number(profileResult.experience_years) || Number(expResult.experience_years) || null;
            const matchResult = await sendMessage<any>({
              type: 'COMPUTE_MATCH_SCORE',
              payload: {
                job: result.job,
                candidateSkills: profileResult.skills,
                candidateExperience: candExp,
              },
            });
            if (matchResult && matchResult.score !== undefined) {
              setMatchScore(matchResult);
              setStatus(`Job detected. Match score: ${matchResult.score}%.`);
            }
          } else {
            setStatus('Job detected. Profile skills not available for match scoring.');
          }
        } catch (matchError) {
          setStatus('Job detected. Match scoring unavailable.');
          console.error('Match scoring error:', matchError);
        }
      } else if (!authenticated) {
        setStatus('Job detected. Sign in to enable match scoring.');
      } else {
        setStatus('Job detected. Review them in the side panel before saving.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Job detection failed.');
    } finally {
      setBusy(false);
    }
  }

  async function generateCoverLetter() {
    if (!job || !authenticated) return;
    setBusy(true);
    setStatus('Generating cover letter…');
    setCoverLetter(null);
    try {
      const result = await sendMessage<any>({
        type: 'GENERATE_COVER_LETTER',
        payload: { job },
      });
      if (result.ok && result.coverLetter) {
        setCoverLetter(result.coverLetter);
        setStatus('Cover letter generated successfully.');
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

  async function copyCoverLetter() {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = coverLetter;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  async function smartApplyJob() {
    if (!job || !authenticated) return;
    setBusy(true);
    setStatus('Smart Auto-Apply running…');
    setSmartApplyResult(null);
    try {
      const activeTab = await sendMessage<ResponseData & { url?: string; tabId?: number }>({
        type: 'GET_ACTIVE_TAB',
      });
      if (!activeTab.ok || !activeTab.url || activeTab.tabId === undefined) {
        throw new Error('Please open a job application page in the active tab.');
      }

      const formResult = await sendTabMessage<any>(activeTab.tabId, {
        type: 'PREVIEW_AUTOFILL',
        payload: {
          candidateData: {
            fullName: job.title ? job.title.replace(/[0-9]/g, '') : '',
            email: '',
            phone: '',
            location: '',
          },
          isApplicationApproved: true,
        },
      });

      if (!formResult.ok || !formResult.plan) {
        throw new Error(formResult.error || 'Could not detect form fields.');
      }

      const autoApprovePlan = {
        ...formResult.plan,
        fields: formResult.plan.fields.map((f: any) => ({ ...f, approved: true })),
        isApplicationApproved: true,
      };

      const autoResult = await sendTabMessage<any>(activeTab.tabId, {
        type: 'APPLY_AUTOFILL',
        payload: { plan: autoApprovePlan },
      });

      const injectedCount = autoResult?.injectedCount || 0;
      const skippedCount = autoResult?.skippedCount || 0;

      setSmartApplyResult({
        ok: injectedCount > 0,
        injectedCount,
        skippedCount,
        message: `Safely filled ${injectedCount} fields.${
          skippedCount > 0 ? ` ${skippedCount} skipped for safety.` : ''
        } Review the form and submit manually.`,
      });

      setStatus(`${injectedCount} fields auto-filled. Please review and submit manually.`);
    } catch (error) {
      setSmartApplyResult({
        ok: false,
        injectedCount: 0,
        skippedCount: 0,
        message: error instanceof Error ? error.message : 'Smart Auto-Apply failed.',
      });
      setStatus('Smart Auto-Apply failed. Please try again.');
      console.error('Smart Auto-Apply error:', error);
    } finally {
      setBusy(false);
    }
  }

  async function openDashboard() {
    await chrome.tabs.create({
      url:
        import.meta.env.DEV || import.meta.env.PROGENI_LOCAL
          ? 'http://localhost:3000/dashboard'
          : 'https://job.progeni.live/dashboard',
    });
    window.close();
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

  if (authenticated === null) {
    return (
      <main className="popup">
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
      <main className="popup">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <strong>Progeni AutoApply</strong>
            <span>Sign in to your career workspace</span>
          </div>
          <span className="brand-badge">
            <Icon name="shield" /> SECURE
          </span>
        </header>

        <section className="card">
          <p className="eyebrow">Welcome</p>
          <h1>{authMode === 'sign-up' ? 'Create your account' : 'Sign back in'}</h1>
          <p>Use the same account as your Progeni web dashboard.</p>

          <div className="segmented" role="tablist" aria-label="Authentication mode">
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

          <p className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
            Never share your password or one-time codes.
          </p>
        </section>

        {status && (
          <p className="status" role="status">
            {status}
          </p>
        )}
      </main>
    );
  }

  if (consent !== true) {
    return (
      <main className="popup">
        <header className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-text">
            <strong>Progeni AutoApply</strong>
            <span>{localMode ? 'Local career workspace' : 'Account career workspace'}</span>
          </div>
        </header>

        <section className="card card-hero">
          <span className="pill">
            <Icon name="shield" />
            Privacy first
          </span>
          <h1 style={{ marginTop: 10 }}>Before you begin</h1>
          <p>
            With your permission, Progeni reads job details only when you choose Detect. Your profile,
            detected jobs, and tracker are stored{' '}
            {localMode
              ? 'on this device by the local backend.'
              : 'in the Progeni workspace linked to your account.'}{' '}
            They are not sent to an AI provider or job site.
          </p>
          <p className="muted">
            Resume files are processed to suggest details; the original file and full text are not saved.
            You can clear your workspace data. Submission is always manual.
          </p>
          <button className="primary" disabled={busy || consent === null} onClick={() => void acceptConsent()}>
            {busy ? 'Connecting…' : 'I agree and continue'}
          </button>
          {consent === null && (
            <button className="secondary" disabled={busy} onClick={() => void refreshConsent()}>
              Retry connection
            </button>
          )}
        </section>

        {status && (
          <p className="status" role="status">
            {status}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="popup">
      <header className="brand">
        <div className="brand-mark">P</div>
        <div className="brand-text">
          <strong>Progeni AutoApply</strong>
          <span>{localMode ? 'Career workspace · local' : 'Career workspace · account'}</span>
        </div>
        <span className="brand-badge">
          <span className="pill-dot" />
          {localMode ? 'LOCAL' : 'LIVE'}
        </span>
      </header>

      {/* Current job */}
      <section className="card card-hero">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current tab</p>
            <h1>Current job</h1>
            <p>Detect job details only when you ask.</p>
          </div>
          <span className="brand-mark" style={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: 9 }}>
            <Icon name="radar" />
          </span>
        </div>

        <button className="primary" disabled={busy} onClick={() => void detectJob()}>
          <Icon name="search" />
          {busy ? 'Working…' : 'Detect this job'}
        </button>

        {matchScore && (
          <div className="match-score-card">
            <div className="score-ring">
              <div
                className="score"
                style={{ '--score': matchScore.score } as unknown as React.CSSProperties}
              >
                {matchScore.score}
              </div>
              <div>
                <strong>Match score {matchScore.score}%</strong>
                <p>{matchScore.explanation?.join('. ') || 'No details available.'}</p>
              </div>
            </div>
            {matchScore.matchedSkills.length > 0 && (
              <div>
                <p className="muted">Matched skills</p>
                <div className="skill-chips">
                  {matchScore.matchedSkills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
            )}
            {matchScore.missingSkills.length > 0 && (
              <div>
                <p className="muted">Suggested skills to add</p>
                <div className="skill-chips">
                  {matchScore.missingSkills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {job && (
          <div className="button-row">
            <button className="secondary" disabled={busy} onClick={() => void generateCoverLetter()}>
              <Icon name="wand" />
              Cover letter
            </button>
            <button className="secondary" disabled={busy} onClick={() => void smartApplyJob()}>
              <Icon name="sparkles" />
              Smart apply
            </button>
            <button className="primary" onClick={() => void openDashboard()}>
              <Icon name="external" />
              Open dashboard
            </button>
            <button
              className="ghost"
              onClick={() => void sendMessage({ type: 'OPEN_SIDE_PANEL' })}
            >
              <Icon name="panel" />
              Side panel
            </button>
          </div>
        )}

        {!job && (
          <p className="muted" style={{ marginTop: 10 }}>
            Tip: open a Naukri, LinkedIn, or Indeed job page, then click Detect.
          </p>
        )}
      </section>

      {coverLetter && (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Draft</p>
              <h2>Generated cover letter</h2>
            </div>
            <button
              type="button"
              className="ghost"
              style={{ width: 'auto', margin: 0, padding: '4px 8px', minHeight: 30 }}
              onClick={() => void copyCoverLetter()}
            >
              <Icon name={copied ? 'check' : 'copy'} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="cover-letter-card">
            <p>{coverLetter}</p>
          </div>
          <p className="muted">Review and personalize before sending. Nothing is submitted automatically.</p>
        </section>
      )}

      {smartApplyResult && (
        <section className="card">
          <div className="smart-apply-result">
            <strong>
              {smartApplyResult.ok ? 'Fields prepared for review' : 'Could not prepare the form'}
            </strong>
            <p className="meta">
              <span>
                Filled: <b>{smartApplyResult.injectedCount}</b>
              </span>
              <span>
                Skipped: <b>{smartApplyResult.skippedCount}</b>
              </span>
            </p>
            <p className="muted" style={{ marginTop: 6 }}>
              {smartApplyResult.message}
            </p>
          </div>
        </section>
      )}

      <p className="policy-note">
        Manual review and submission only. Progeni never clicks Apply or bypasses platform controls.
      </p>

      {!localMode && (
        <button className="ghost" disabled={busy} onClick={() => void leaveAccount()}>
          <Icon name="logout" />
          Sign out
        </button>
      )}

      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}
    </main>
  );
}
