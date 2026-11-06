'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getCandidateProfileExtended,
  updateCandidateProfileExtended,
  type CandidateProfileExtended,
} from '../../../lib/api';

const emptyProfile: CandidateProfileExtended = {
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

export default function CandidateProfilePage() {
  const [profile, setProfile] = useState<CandidateProfileExtended>(emptyProfile);
  const [skillsText, setSkillsText] = useState('');
  const [completenessScore, setCompletenessScore] = useState(0);
  const [completedFields, setCompletedFields] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void getCandidateProfileExtended()
      .then((res) => {
        if (res.profile) {
          setProfile(res.profile);
          if (res.profile.skills) setSkillsText(res.profile.skills.join(', '));
        }
        if (res.completeness) {
          setCompletenessScore(res.completeness.score);
          setCompletedFields(res.completeness.completedFields);
          setMissingFields(res.completeness.missingFields);
        }
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.');
      })
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CandidateProfileExtended>(key: K, value: CandidateProfileExtended[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const skills = [...new Set(skillsText.split(',').map((skill) => skill.trim()).filter(Boolean))];
      const res = await updateCandidateProfileExtended({
        ...profile,
        location: profile.city && profile.country ? `${profile.city}, ${profile.country}` : profile.location,
        skills,
      });
      setProfile(res.profile);
      setCompletenessScore(res.completeness.score);
      setCompletedFields(res.completeness.completedFields);
      setMissingFields(res.completeness.missingFields);
      setNotice('Your career profile was saved to your workspace.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR CAREER IDENTITY</p>
          <h1>Career profile</h1>
          <p>Use information you can support with real experience. Progeni never invents qualifications.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link className="button button-secondary" href="/onboarding">
            ✦ Onboarding wizard
          </Link>
          <Link className="button button-secondary" href="/dashboard">
            Back to overview
          </Link>
        </div>
      </header>

      {/* Profile Completeness Summary */}
      <section className="card card-padding" style={{ maxWidth: 850, marginBottom: '1.5rem', background: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>Career Profile Completeness</span>
          <strong style={{ fontSize: '16px', color: completenessScore >= 80 ? '#16a34a' : '#d97706' }}>
            {completenessScore}%
          </strong>
        </div>
        <div style={{ height: '8px', width: '100%', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
          <div
            style={{
              height: '100%',
              width: `${completenessScore}%`,
              background: completenessScore >= 80 ? '#16a34a' : '#3b82f6',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        {missingFields.length > 0 && (
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
            Missing optional fields: {missingFields.join(', ')}
          </p>
        )}
      </section>

      <section className="card card-padding" style={{ maxWidth: 850 }}>
        <div className="page-heading" style={{ marginBottom: 8 }}>
          <div>
            <h2 className="card-title">Candidate details</h2>
            <p className="card-description">Your profile is stored in your workspace and used to explain job matches.</p>
          </div>
          <span className="local-pill"><span className="online-dot" /> WORKSPACE DATA</span>
        </div>

        {loading ? (
          <p className="empty-state">Loading your profile…</p>
        ) : (
          <form onSubmit={(event) => void handleSave(event)}>
            <div className="form-grid">
              <label className="field">
                Full name *
                <input
                  required
                  autoComplete="name"
                  maxLength={120}
                  value={profile.full_name || ''}
                  onChange={(event) => update('full_name', event.target.value)}
                  placeholder="Your full legal name"
                />
              </label>

              <label className="field">
                Email address *
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={profile.email || ''}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="you@example.com"
                />
              </label>

              <label className="field">
                Phone number
                <input
                  autoComplete="tel"
                  maxLength={40}
                  value={profile.phone || ''}
                  onChange={(event) => update('phone', event.target.value)}
                  placeholder="+91 9876543210"
                />
              </label>

              <label className="field">
                Target role *
                <input
                  required
                  maxLength={120}
                  value={profile.target_role || ''}
                  onChange={(event) => update('target_role', event.target.value)}
                  placeholder="Python Developer, Full Stack Engineer"
                />
              </label>

              <label className="field">
                City
                <input
                  maxLength={100}
                  value={profile.city || ''}
                  onChange={(event) => update('city', event.target.value)}
                  placeholder="Bengaluru"
                />
              </label>

              <label className="field">
                Country
                <input
                  maxLength={100}
                  value={profile.country || ''}
                  onChange={(event) => update('country', event.target.value)}
                  placeholder="India"
                />
              </label>

              <label className="field">
                Years of experience
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="0.5"
                  value={profile.experience_years ?? ''}
                  onChange={(event) =>
                    update('experience_years', event.target.value === '' ? null : Number(event.target.value))
                  }
                  placeholder="Not specified"
                />
              </label>

              <label className="field">
                LinkedIn profile URL
                <input
                  type="url"
                  value={profile.linkedin_url || ''}
                  onChange={(event) => update('linkedin_url', event.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </label>

              <label className="field">
                GitHub profile URL
                <input
                  type="url"
                  value={profile.github_url || ''}
                  onChange={(event) => update('github_url', event.target.value)}
                  placeholder="https://github.com/username"
                />
              </label>

              <label className="field">
                Portfolio website URL
                <input
                  type="url"
                  value={profile.portfolio_url || ''}
                  onChange={(event) => update('portfolio_url', event.target.value)}
                  placeholder="https://myportfolio.com"
                />
              </label>

              <label className="field field-full">
                Technical Skills (comma-separated)
                <input
                  value={skillsText}
                  onChange={(event) => setSkillsText(event.target.value)}
                  placeholder="Python, SQL, FastAPI, TypeScript, React"
                />
                <span className="card-description">Separate skills with commas. Only list skills you can substantiate.</span>
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="button button-primary" disabled={busy || loading}>
                {busy ? 'Saving…' : 'Save profile changes'}
              </button>
              <span className="card-description">Your profile is stored privately in your workspace.</span>
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-success" role="status">{notice}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
