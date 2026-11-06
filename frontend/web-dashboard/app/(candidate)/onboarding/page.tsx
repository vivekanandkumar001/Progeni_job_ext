'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  getCandidateOnboarding,
  updateCandidateOnboarding,
  getCandidateProfileExtended,
  updateCandidateProfileExtended,
  getCandidatePreferences,
  updateCandidatePreferences,
  uploadCandidateResume,
  createExtensionPairingCode,
  getMe,
  type CandidateProfileExtended,
  type CandidatePreferences,
  type ResumeAnalysis,
  type OnboardingStatusResponse,
} from '../../../lib/api';

const defaultProfile: CandidateProfileExtended = {
  full_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  target_role: '',
  experience_level: 'mid',
  location: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  skills: [],
  experience_years: null,
};

const defaultPreferences: CandidatePreferences = {
  desired_roles: [],
  preferred_locations: [],
  workplace_type: 'remote',
  expected_salary: {
    currency: 'INR',
    min: null,
    max: null,
    period: 'yearly',
  },
  experience_level: 'mid',
  joining_availability: 'immediate',
  employment_type: 'full-time',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

const STEPS = [
  { step: 1, title: 'Personal Identity', description: 'Contact & verified profiles' },
  { step: 2, title: 'Career Preferences', description: 'Target roles & compensation' },
  { step: 3, title: 'Resume Intelligence', description: 'Secure parsing & evidence' },
  { step: 4, title: 'Extension & Consent', description: 'Pair browser & set privacy' },
  { step: 5, title: 'Review & Launch', description: 'Completeness & confirmation' },
];

export default function CandidateOnboardingPage() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Stage 1 State
  const [profile, setProfile] = useState<CandidateProfileExtended>(defaultProfile);
  const [skillsInput, setSkillsInput] = useState('');

  // Stage 2 State
  const [preferences, setPreferences] = useState<CandidatePreferences>(defaultPreferences);
  const [rolesInput, setRolesInput] = useState('');
  const [locationsInput, setLocationsInput] = useState('');

  // Stage 3 State
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploadedResumeTitle, setUploadedResumeTitle] = useState('');

  // Stage 4 State
  const [pairingCode, setPairingCode] = useState('');
  const [pairingExpiresIn, setPairingExpiresIn] = useState(0);
  const [extensionConnected, setExtensionConnected] = useState(false);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(false);
  const [jobAssistanceConsent, setJobAssistanceConsent] = useState(false);

  // Stage 5 State
  const [completenessScore, setCompletenessScore] = useState(0);
  const [completedFields, setCompletedFields] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Load existing onboarding, profile, and preferences
  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [onboardRes, profRes, prefRes, meRes] = await Promise.all([
        getCandidateOnboarding().catch(() => null),
        getCandidateProfileExtended().catch(() => null),
        getCandidatePreferences().catch(() => null),
        getMe().catch(() => null),
      ]);

      if (onboardRes?.onboarding) {
        setCurrentStep(onboardRes.onboarding.current_step || 1);
        setCompletedSteps(onboardRes.onboarding.completed_steps || []);
        setDataProcessingConsent(Boolean(onboardRes.onboarding.consents?.data_processing?.accepted));
        setJobAssistanceConsent(Boolean(onboardRes.onboarding.consents?.job_application_assistance?.accepted));
        setExtensionConnected(Boolean(onboardRes.extensionConnected));
      }

      const loadedProfile = profRes?.profile;
      if (loadedProfile) {
        setProfile((prev) => ({
          ...prev,
          ...loadedProfile,
          email: loadedProfile.email || meRes?.user?.email || prev.email,
        }));
        if (loadedProfile.skills && Array.isArray(loadedProfile.skills)) {
          setSkillsInput(loadedProfile.skills.join(', '));
        }
      } else if (meRes?.user?.email) {
        setProfile((prev) => ({ ...prev, email: meRes.user.email }));
      }

      if (prefRes) {
        setPreferences(prefRes);
        if (prefRes.desired_roles) setRolesInput(prefRes.desired_roles.join(', '));
        if (prefRes.preferred_locations) setLocationsInput(prefRes.preferred_locations.join(', '));
      }

      if (onboardRes?.completeness) {
        setCompletenessScore(onboardRes.completeness.score);
        setCompletedFields(onboardRes.completeness.completedFields);
        setMissingFields(onboardRes.completeness.missingFields);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load onboarding data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Timer countdown for pairing code
  useEffect(() => {
    if (pairingExpiresIn <= 0) return;
    const interval = setInterval(() => {
      setPairingExpiresIn((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPairingCode('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairingExpiresIn]);

  function updateProfileField<K extends keyof CandidateProfileExtended>(key: K, value: CandidateProfileExtended[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updatePreferenceField<K extends keyof CandidatePreferences>(key: K, value: CandidatePreferences[K]) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  // --- Step 1 Save ---
  async function handleSaveStep1(e?: FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const skillsArray = skillsInput.split(',').map((s) => s.trim()).filter(Boolean);
      const updated = await updateCandidateProfileExtended({
        ...profile,
        location: profile.city && profile.country ? `${profile.city}, ${profile.country}` : profile.location,
        skills: skillsArray,
      });

      setProfile(updated.profile);
      setCompletenessScore(updated.completeness.score);
      setCompletedFields(updated.completeness.completedFields);
      setMissingFields(updated.completeness.missingFields);

      await updateCandidateOnboarding({ step: 2, completeStep: 1 });
      setCompletedSteps((prev) => Array.from(new Set([...prev, 1])));
      setCurrentStep(2);
      setNotice('Personal identity saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save personal identity.');
    } finally {
      setSaving(false);
    }
  }

  // --- Step 2 Save ---
  async function handleSaveStep2(e?: FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const desired_roles = rolesInput.split(',').map((r) => r.trim()).filter(Boolean);
      const preferred_locations = locationsInput.split(',').map((l) => l.trim()).filter(Boolean);

      const savedPref = await updateCandidatePreferences({
        ...preferences,
        desired_roles,
        preferred_locations,
      });

      setPreferences(savedPref);

      // Also ensure primary target_role is mirrored in profile if not already set
      if (desired_roles.length > 0 && !profile.target_role) {
        await updateCandidateProfileExtended({ target_role: desired_roles[0] });
      }

      await updateCandidateOnboarding({ step: 3, completeStep: 2 });
      setCompletedSteps((prev) => Array.from(new Set([...prev, 2])));
      setCurrentStep(3);
      setNotice('Career preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save career preferences.');
    } finally {
      setSaving(false);
    }
  }

  // --- Step 3: Resume Upload & Analysis ---
  async function handleResumeUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError('');
    setNotice('');
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'docx' && extension !== 'txt') {
      setError('Please select a valid PDF, DOCX, or UTF-8 text file.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Resume file exceeds the maximum allowed size of 5 MB.');
      return;
    }

    if (file.size === 0) {
      setError('Selected file is empty.');
      return;
    }

    setParsing(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = toBase64(bytes);

      const result = await uploadCandidateResume(file.name, extension as any, base64, file.name);
      setAnalysis(result.analysis);
      setUploadedResumeTitle(result.resume.title || file.name);

      // Pre-populate missing profile fields with detected resume facts
      const detected = result.analysis.detected;
      const detectedSkills = result.analysis.skills.map((s) => s.skill);

      const currentSkills = new Set(skillsInput.split(',').map((s) => s.trim()).filter(Boolean));
      detectedSkills.forEach((s) => currentSkills.add(s));
      const combinedSkills = Array.from(currentSkills);

      setSkillsInput(combinedSkills.join(', '));
      setProfile((prev) => ({
        ...prev,
        full_name: prev.full_name || detected.fullName || prev.full_name,
        email: prev.email || detected.email || prev.email,
        phone: prev.phone || detected.phone || prev.phone,
        experience_years: prev.experience_years ?? detected.experienceYears ?? prev.experience_years,
        skills: combinedSkills,
      }));

      // Update profile on backend with extracted facts
      await updateCandidateProfileExtended({
        skills: combinedSkills,
        experience_years: profile.experience_years ?? detected.experienceYears,
      });

      setNotice('Resume parsed and securely stored. Review the extracted skills and experience below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume document.');
    } finally {
      setParsing(false);
    }
  }

  async function handleSaveStep3() {
    setSaving(true);
    setError('');
    try {
      await updateCandidateOnboarding({ step: 4, completeStep: 3 });
      setCompletedSteps((prev) => Array.from(new Set([...prev, 3])));
      setCurrentStep(4);
      setNotice('Resume step confirmed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not proceed to next step.');
    } finally {
      setSaving(false);
    }
  }

  // --- Step 4: Extension & Consent ---
  async function handleGeneratePairingCode() {
    setSaving(true);
    setError('');
    try {
      const res = await createExtensionPairingCode();
      setPairingCode(res.pairingCode);
      setPairingExpiresIn(res.expiresInSeconds || 300);
      setNotice('New pairing code generated. Enter it into the Progeni Chrome Extension Side Panel.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate extension pairing code.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckExtensionConnection() {
    setSaving(true);
    try {
      const res = await getCandidateOnboarding();
      setExtensionConnected(Boolean(res.extensionConnected));
      if (res.extensionConnected) {
        setNotice('Chrome Extension verified and actively connected!');
      } else {
        setNotice('No active extension session detected yet. Ensure you entered the pairing code in the extension.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify extension status.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveStep4() {
    if (!dataProcessingConsent) {
      setError('Data processing consent is required to activate candidate matching and workspace features.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateCandidateOnboarding({
        step: 5,
        completeStep: 4,
        dataProcessingConsent,
        jobAssistanceConsent,
      });

      setCompletedSteps((prev) => Array.from(new Set([...prev, 4])));
      setCurrentStep(5);

      // Refresh completeness
      const statusRes = await getCandidateOnboarding();
      setCompletenessScore(statusRes.completeness.score);
      setCompletedFields(statusRes.completeness.completedFields);
      setMissingFields(statusRes.completeness.missingFields);

      setNotice('Consents and extension settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consent settings.');
    } finally {
      setSaving(false);
    }
  }

  // --- Step 5: Complete & Launch ---
  async function handleCompleteOnboarding() {
    setSaving(true);
    setError('');
    try {
      await updateCandidateOnboarding({
        status: 'completed',
        step: 5,
        completeStep: 5,
      });

      setNotice('Onboarding successfully completed! Redirecting to your dashboard…');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding.');
      setSaving(false);
    }
  }

  async function handleSaveAndResumeLater() {
    setSaving(true);
    setError('');
    try {
      await updateCandidateOnboarding({ step: currentStep });
      setNotice('Progress saved! You can resume at any time.');
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save progress.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card card-padding" style={{ maxWidth: 850, margin: '2rem auto' }}>
        <p className="empty-state">Loading your onboarding workspace…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <header className="page-heading" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">CANDIDATE ONBOARDING SETUP</p>
          <h1>Welcome to Auto Apply AI</h1>
          <p>Complete your 5-stage career profile to activate job fit intelligence and application assistance.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void handleSaveAndResumeLater()}
            disabled={saving}
          >
            Save &amp; Resume Later
          </button>
          <Link href="/dashboard" className="button button-secondary">
            Go to Dashboard
          </Link>
        </div>
      </header>

      {/* Wizard Step Progression Bar */}
      <nav aria-label="Onboarding Steps" className="card card-padding" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {STEPS.map((s) => {
            const isActive = currentStep === s.step;
            const isDone = completedSteps.includes(s.step);
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => (isDone || s.step <= currentStep) && setCurrentStep(s.step)}
                style={{
                  textAlign: 'left',
                  background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                  border: isActive ? '2px solid rgb(var(--info))' : '1px solid rgb(var(--outline-variant))',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  cursor: isDone || s.step <= currentStep ? 'pointer' : 'not-allowed',
                  opacity: isDone || s.step <= currentStep ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: isActive ? 'rgb(var(--info))' : 'rgb(var(--on-surface-variant))' }}>
                    STAGE {s.step}
                  </span>
                  {isDone ? (
                    <span style={{ color: 'rgb(var(--success))', fontWeight: 'bold', fontSize: '12px' }}>✓ Done</span>
                  ) : isActive ? (
                    <span className="online-dot" />
                  ) : null}
                </div>
                <strong style={{ fontSize: '13px', display: 'block', color: 'rgb(var(--on-surface))' }}>{s.title}</strong>
                <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>{s.description}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Alerts */}
      {error && (
        <div className="form-error" style={{ marginBottom: '1rem', padding: '12px', borderRadius: '8px' }} role="alert">
          <strong>Error:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="form-success" style={{ marginBottom: '1rem', padding: '12px', borderRadius: '8px' }} role="status">
          {notice}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STAGE 1: PERSONAL IDENTITY */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">STAGE 1 OF 5</p>
              <h2 className="card-title">Personal Identity &amp; Contact Details</h2>
              <p className="card-description">
                Provide your accurate identity and verified professional links. Progeni never invents candidate information.
              </p>
            </div>
            <span className="local-pill"><span className="online-dot" /> REQUIRED</span>
          </div>

          <form onSubmit={(e) => void handleSaveStep1(e)}>
            <div className="form-grid">
              <label className="field">
                Full Legal Name *
                <input
                  required
                  maxLength={120}
                  value={profile.full_name || ''}
                  onChange={(e) => updateProfileField('full_name', e.target.value)}
                  placeholder="e.g. Alex Mercer"
                />
              </label>

              <label className="field">
                Verified Email Address *
                <input
                  type="email"
                  required
                  value={profile.email || ''}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                  placeholder="alex.mercer@example.com"
                />
              </label>

              <label className="field">
                Phone Number
                <input
                  type="tel"
                  maxLength={40}
                  value={profile.phone || ''}
                  onChange={(e) => updateProfileField('phone', e.target.value)}
                  placeholder="+91 9876543210"
                />
              </label>

              <label className="field">
                Primary Target Role *
                <input
                  required
                  maxLength={120}
                  value={profile.target_role || ''}
                  onChange={(e) => updateProfileField('target_role', e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer"
                />
              </label>

              <label className="field">
                Current City
                <input
                  maxLength={100}
                  value={profile.city || ''}
                  onChange={(e) => updateProfileField('city', e.target.value)}
                  placeholder="e.g. Bengaluru"
                />
              </label>

              <label className="field">
                Current Country
                <input
                  maxLength={100}
                  value={profile.country || ''}
                  onChange={(e) => updateProfileField('country', e.target.value)}
                  placeholder="e.g. India"
                />
              </label>

              <label className="field">
                Years of Professional Experience
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="0.5"
                  value={profile.experience_years ?? ''}
                  onChange={(e) => updateProfileField('experience_years', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 5"
                />
              </label>

              <label className="field field-full">
                Core Technical Skills (comma-separated)
                <input
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="TypeScript, React, Node.js, PostgreSQL, Docker"
                />
                <span className="card-description">Only list skills you can substantiate in technical screenings.</span>
              </label>

              <label className="field">
                LinkedIn Profile URL
                <input
                  type="url"
                  value={profile.linkedin_url || ''}
                  onChange={(e) => updateProfileField('linkedin_url', e.target.value)}
                  placeholder="https://linkedin.com/in/alexmercer"
                />
              </label>

              <label className="field">
                GitHub Profile URL
                <input
                  type="url"
                  value={profile.github_url || ''}
                  onChange={(e) => updateProfileField('github_url', e.target.value)}
                  placeholder="https://github.com/alexmercer"
                />
              </label>

              <label className="field field-full">
                Portfolio or Personal Website URL
                <input
                  type="url"
                  value={profile.portfolio_url || ''}
                  onChange={(e) => updateProfileField('portfolio_url', e.target.value)}
                  placeholder="https://alexmercer.dev"
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save & Continue to Career Preferences →'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STAGE 2: CAREER PREFERENCES */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">STAGE 2 OF 5</p>
              <h2 className="card-title">Career Preferences &amp; Target Compensation</h2>
              <p className="card-description">
                Define the roles, locations, work modes, and expected compensation for intelligent job matching.
              </p>
            </div>
            <span className="local-pill"><span className="online-dot" /> SEARCH PARAMETERS</span>
          </div>

          <form onSubmit={(e) => void handleSaveStep2(e)}>
            <div className="form-grid">
              <label className="field field-full">
                Desired Job Roles (comma-separated) *
                <input
                  required
                  value={rolesInput}
                  onChange={(e) => setRolesInput(e.target.value)}
                  placeholder="Full Stack Engineer, Backend Lead, Cloud Architect"
                />
              </label>

              <label className="field field-full">
                Preferred Locations (comma-separated) *
                <input
                  required
                  value={locationsInput}
                  onChange={(e) => setLocationsInput(e.target.value)}
                  placeholder="Bengaluru, Pune, Hyderabad, Remote"
                />
              </label>

              <label className="field">
                Workplace Mode *
                <select
                  value={preferences.workplace_type}
                  onChange={(e) => updatePreferenceField('workplace_type', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgb(var(--outline))' }}
                >
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid (Office + Remote)</option>
                  <option value="office">In-Office</option>
                  <option value="any">Open to Any Mode</option>
                </select>
              </label>

              <label className="field">
                Experience Level *
                <select
                  value={preferences.experience_level}
                  onChange={(e) => updatePreferenceField('experience_level', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgb(var(--outline))' }}
                >
                  <option value="entry">Entry-Level (0-2 years)</option>
                  <option value="mid">Mid-Level (3-5 years)</option>
                  <option value="senior">Senior (6-9 years)</option>
                  <option value="lead">Lead / Staff (10+ years)</option>
                  <option value="executive">Director / Executive</option>
                </select>
              </label>

              <label className="field">
                Joining Availability *
                <select
                  value={preferences.joining_availability}
                  onChange={(e) => updatePreferenceField('joining_availability', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgb(var(--outline))' }}
                >
                  <option value="immediate">Immediate / Serving Notice</option>
                  <option value="15_days">Within 15 Days</option>
                  <option value="30_days">30 Days Notice Period</option>
                  <option value="60_days">60 Days Notice Period</option>
                  <option value="90_days">90 Days Notice Period</option>
                </select>
              </label>

              <label className="field">
                Employment Type *
                <select
                  value={preferences.employment_type}
                  onChange={(e) => updatePreferenceField('employment_type', e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgb(var(--outline))' }}
                >
                  <option value="full-time">Full-Time Permanent</option>
                  <option value="contract">Contract / Consulting</option>
                  <option value="part-time">Part-Time</option>
                  <option value="internship">Internship</option>
                </select>
              </label>

              <label className="field">
                Salary Currency
                <select
                  value={preferences.expected_salary.currency}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      expected_salary: { ...prev.expected_salary, currency: e.target.value },
                    }))
                  }
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgb(var(--outline))' }}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </label>

              <label className="field">
                Minimum Expected Salary
                <input
                  type="number"
                  min="0"
                  value={preferences.expected_salary.min ?? ''}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      expected_salary: {
                        ...prev.expected_salary,
                        min: e.target.value === '' ? null : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="e.g. 1800000"
                />
              </label>

              <label className="field">
                Maximum Expected Salary
                <input
                  type="number"
                  min="0"
                  value={preferences.expected_salary.max ?? ''}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      expected_salary: {
                        ...prev.expected_salary,
                        max: e.target.value === '' ? null : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="e.g. 2600000"
                />
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="button button-secondary" onClick={() => setCurrentStep(1)}>
                ← Back to Personal Identity
              </button>
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save & Continue to Resume Intelligence →'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STAGE 3: RESUME INTELLIGENCE */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">STAGE 3 OF 5</p>
              <h2 className="card-title">Resume Intelligence &amp; Skill Extraction</h2>
              <p className="card-description">
                Upload your resume (PDF, DOCX, or UTF-8 text, max 5 MB). The backend parser extracts your verified skills and experience evidence.
              </p>
            </div>
            <span className="local-pill"><span className="online-dot" /> PRIVATE STORAGE</span>
          </div>

          <div
            style={{
              border: '2px dashed rgb(var(--outline))',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: 'rgb(var(--surface-subtle))',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📄</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgb(var(--on-surface))', marginBottom: '4px' }}>
              Upload Your Resume Document
            </h3>
            <p style={{ fontSize: '13px', color: 'rgb(var(--on-surface-variant))', marginBottom: '12px' }}>
              Supports text-based PDF, DOCX, or TXT (up to 5 MB). File is stored privately in your workspace.
            </p>

            <label className="button button-primary" style={{ display: 'inline-block', cursor: 'pointer' }}>
              {parsing ? 'Parsing Document…' : 'Select Resume File'}
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => void handleResumeUpload(e)}
                disabled={parsing}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Uploaded / Analyzed Result Preview */}
          {analysis && (
            <div style={{ backgroundColor: 'rgb(var(--surface))', border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '16px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <strong>Extracted from: {analysis.fileName} ({analysis.fileType.toUpperCase()})</strong>
                <span className="score-chip" style={{ background: 'rgb(var(--success-container))', color: 'rgb(var(--success))' }}>
                  {analysis.status === 'ready' ? 'High Confidence' : 'Review Recommended'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div><span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>Detected Name:</span> <strong>{analysis.detected.fullName || 'Not detected'}</strong></div>
                <div><span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>Detected Email:</span> <strong>{analysis.detected.email || 'Not detected'}</strong></div>
                <div><span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>Detected Phone:</span> <strong>{analysis.detected.phone || 'Not detected'}</strong></div>
                <div><span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>Experience:</span> <strong>{analysis.detected.experienceYears !== null ? `${analysis.detected.experienceYears} Years` : 'Not specified'}</strong></div>
              </div>

              {analysis.skills.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--on-surface-variant))', marginBottom: '6px' }}>
                    Verified Skills with Document Evidence ({analysis.skills.length}):
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {analysis.skills.map((s) => (
                      <span
                        key={s.skill}
                        style={{
                          fontSize: '12px',
                          background: 'rgb(var(--surface-variant))',
                          border: '1px solid rgb(var(--outline))',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          color: 'rgb(var(--on-surface))',
                        }}
                        title={s.evidence}
                      >
                        {s.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {analysis.warnings.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {analysis.warnings.map((w, idx) => (
                    <div key={idx} className="notice" style={{ fontSize: '12px', marginBottom: '4px' }}>
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="button button-secondary" onClick={() => setCurrentStep(2)}>
              ← Back to Career Preferences
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleSaveStep3()}
              disabled={saving || parsing}
            >
              Continue to Extension &amp; Consent →
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STAGE 4: EXTENSION CONNECTION & CONSENTS */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">STAGE 4 OF 5</p>
              <h2 className="card-title">Chrome Extension Linking &amp; Explicit Consents</h2>
              <p className="card-description">
                Link your Chrome Extension using a zero-secret pairing code and review your privacy consent controls.
              </p>
            </div>
            <span className="local-pill"><span className="online-dot" /> ZERO-SECRET LINKING</span>
          </div>

          {/* Extension Pairing Card */}
          <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '16px', marginBottom: '1.5rem', background: 'rgb(var(--surface-subtle))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgb(var(--on-surface))' }}>Auto Apply AI Browser Extension</h3>
              {extensionConnected ? (
                <span className="score-chip" style={{ background: 'rgb(var(--success-container))', color: 'rgb(var(--success))' }}>
                  ● Extension Connected
                </span>
              ) : (
                <span className="score-chip" style={{ background: 'rgb(var(--warning-container))', color: 'rgb(var(--warning))' }}>
                  ○ Not Connected
                </span>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'rgb(var(--on-surface-variant))', marginBottom: '12px' }}>
              The Chrome Extension reads job postings on supported career portals (Greenhouse, Lever, Workday) and assists with pre-filling application fields. Final submissions always require your explicit approval.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => void handleGeneratePairingCode()}
                disabled={saving}
              >
                Generate 6-Digit Pairing Code
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => void handleCheckExtensionConnection()}
                disabled={saving}
              >
                Verify Connection Status
              </button>
            </div>

            {pairingCode && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: 'rgb(var(--surface))',
                  border: '2px solid rgb(var(--info))',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgb(var(--info))', letterSpacing: '1px' }}>
                  YOUR SINGLE-USE PAIRING CODE (EXPIRES IN {Math.floor(pairingExpiresIn / 60)}:{(pairingExpiresIn % 60).toString().padStart(2, '0')})
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'rgb(var(--on-surface))', letterSpacing: '4px', margin: '8px 0' }}>
                  {pairingCode}
                </div>
                <p style={{ fontSize: '12px', color: 'rgb(var(--on-surface-variant))' }}>
                  Open the Progeni Chrome Extension Side Panel, click <strong>Pair with Code</strong>, enter this code, and click <strong>Link Extension</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Privacy & Consents Box */}
          <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '16px', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgb(var(--on-surface))', marginBottom: '12px' }}>
              Privacy &amp; Data Processing Controls
            </h3>

            {/* Consent 1 */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={dataProcessingConsent}
                  onChange={(e) => setDataProcessingConsent(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '13px', color: 'rgb(var(--on-surface))' }}>
                  <strong>Data Processing Consent (Policy v1.0) *</strong>
                  <br />
                  <span style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '12px' }}>
                    I authorize Auto Apply AI to store my candidate profile, parsed resume metadata, and career preferences in my workspace to evaluate eligibility against job postings.
                  </span>
                </span>
              </label>
            </div>

            {/* Consent 2 */}
            <div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={jobAssistanceConsent}
                  onChange={(e) => setJobAssistanceConsent(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '13px', color: 'rgb(var(--on-surface))' }}>
                  <strong>Job Application Assistance Consent (Controlled Automation)</strong>
                  <br />
                  <span style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '12px' }}>
                    I authorize the extension to assist with pre-filling application form fields based on my verified profile. I acknowledge that Auto Apply AI never submits applications automatically; I will review every form before submitting.
                  </span>
                </span>
              </label>
            </div>

            <div style={{ marginTop: '12px', fontSize: '12px', color: 'rgb(var(--on-surface-variant))' }}>
              You may withdraw either consent at any time from <Link href="/settings-privacy">Privacy &amp; data</Link>.
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="button button-secondary" onClick={() => setCurrentStep(3)}>
              ← Back to Resume Intelligence
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleSaveStep4()}
              disabled={saving}
            >
              Continue to Review &amp; Launch →
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* STAGE 5: PROFILE REVIEW & LAUNCH */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <section className="card card-padding">
          <div className="page-heading" style={{ marginBottom: '1rem' }}>
            <div>
              <p className="eyebrow">STAGE 5 OF 5</p>
              <h2 className="card-title">Profile Review &amp; Onboarding Completion</h2>
              <p className="card-description">
                Review your complete career profile and completeness score before launching your dashboard.
              </p>
            </div>
            <span className="local-pill"><span className="online-dot" /> FINAL STEP</span>
          </div>

          {/* Completeness Gauge */}
          <div style={{ backgroundColor: 'rgb(var(--surface-subtle))', border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '16px', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'rgb(var(--on-surface))' }}>Profile Completeness</span>
              <strong style={{ fontSize: '16px', color: completenessScore >= 80 ? 'rgb(var(--success))' : 'rgb(var(--warning))' }}>
                {completenessScore}%
              </strong>
            </div>
            <div style={{ height: '8px', width: '100%', background: 'rgb(var(--outline-variant))', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div
                style={{
                  height: '100%',
                  width: `${completenessScore}%`,
                  background: completenessScore >= 80 ? 'rgb(var(--success))' : 'rgb(var(--info))',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <div>
                <strong style={{ color: 'rgb(var(--success))' }}>Completed Criteria ({completedFields.length}):</strong>
                <ul style={{ margin: '4px 0 0 16px', color: 'rgb(var(--on-surface-variant))' }}>
                  {completedFields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong style={{ color: 'rgb(var(--warning))' }}>Optional Missing Criteria ({missingFields.length}):</strong>
                <ul style={{ margin: '4px 0 0 16px', color: 'rgb(var(--on-surface-variant))' }}>
                  {missingFields.length === 0 ? <li>All key criteria completed!</li> : missingFields.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            </div>
          </div>

          {/* Profile Overview Summaries */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '1.5rem' }}>
            {/* Identity Card */}
            <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong>Personal Identity</strong>
                <button type="button" onClick={() => setCurrentStep(1)} style={{ color: 'rgb(var(--info))', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Name:</strong> {profile.full_name || 'Not set'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Email:</strong> {profile.email || 'Not set'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Role:</strong> {profile.target_role || 'Not set'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Location:</strong> {profile.city && profile.country ? `${profile.city}, ${profile.country}` : 'Not set'}</p>
            </div>

            {/* Preferences Card */}
            <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong>Preferences</strong>
                <button type="button" onClick={() => setCurrentStep(2)} style={{ color: 'rgb(var(--info))', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Roles:</strong> {preferences.desired_roles?.join(', ') || 'Not set'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Locations:</strong> {preferences.preferred_locations?.join(', ') || 'Not set'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Workplace:</strong> {preferences.workplace_type}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Availability:</strong> {preferences.joining_availability}</p>
            </div>

            {/* Resume & Skills Card */}
            <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong>Resume &amp; Skills</strong>
                <button type="button" onClick={() => setCurrentStep(3)} style={{ color: 'rgb(var(--info))', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Primary File:</strong> {uploadedResumeTitle || 'Document on file'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Experience:</strong> {profile.experience_years ? `${profile.experience_years} Years` : 'Not specified'}</p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}><strong>Skills Count:</strong> {skillsInput.split(',').filter(Boolean).length} registered</p>
            </div>

            {/* Extension & Consent Card */}
            <div style={{ border: '1px solid rgb(var(--outline-variant))', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong>Extension &amp; Privacy</strong>
                <button type="button" onClick={() => setCurrentStep(4)} style={{ color: 'rgb(var(--info))', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
              </div>
              <p style={{ fontSize: '13px', margin: '2px 0' }}>
                <strong>Extension:</strong> {extensionConnected ? '● Connected' : '○ Pending pairing'}
              </p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}>
                <strong>Data Processing:</strong> {dataProcessingConsent ? '✓ Accepted (v1.0)' : '✗ Not accepted'}
              </p>
              <p style={{ fontSize: '13px', margin: '2px 0' }}>
                <strong>Application Assist:</strong> {jobAssistanceConsent ? '✓ Accepted (v1.0)' : '○ Manual only'}
              </p>
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button type="button" className="button button-secondary" onClick={() => setCurrentStep(4)}>
              ← Back to Extension &amp; Consent
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void handleCompleteOnboarding()}
              disabled={saving}
            >
              {saving ? 'Completing Setup…' : '✓ Complete Onboarding & Open Dashboard'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
