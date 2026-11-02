'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { getProfile, saveProfile, type CandidateProfile } from '../../../lib/api';

const emptyProfile: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  targetRole: '',
  location: '',
  skills: [],
  experienceYears: null,
};

export default function CandidateProfilePage() {
  const [profile, setProfile] = useState(emptyProfile);
  const [skillsText, setSkillsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void getProfile().then((savedProfile) => {
      if (savedProfile) {
        setProfile(savedProfile);
        setSkillsText(savedProfile.skills.join(', '));
      }
    }).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.');
    }).finally(() => setLoading(false));
  }, []);

  function update<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const saved = await saveProfile({
        ...profile,
        skills: [...new Set(skillsText.split(',').map((skill) => skill.trim()).filter(Boolean))],
      });
      setProfile(saved);
      setSkillsText(saved.skills.join(', '));
      setNotice('Your profile was saved to your workspace.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div><p className="eyebrow">YOUR CAREER IDENTITY</p><h1>Career profile</h1><p>Use information you can support with real experience. Progeni never invents qualifications.</p></div>
        <Link className="button button-secondary" href="/dashboard">Back to overview</Link>
      </header>

      <section className="card card-padding" style={{ maxWidth: 850 }}>
        <div className="page-heading" style={{ marginBottom: 8 }}>
          <div><h2 className="card-title">Candidate details</h2><p className="card-description">Your profile is stored in your workspace and used to explain job matches.</p></div>
          <span className="local-pill"><span className="online-dot" /> WORKSPACE DATA</span>
        </div>
        {loading ? <p className="empty-state">Loading your profile…</p> : (
          <form onSubmit={(event) => void handleSave(event)}>
            <div className="form-grid">
              <label className="field">Full name<input autoComplete="name" maxLength={120} value={profile.fullName} onChange={(event) => update('fullName', event.target.value)} placeholder="Your name" /></label>
              <label className="field">Email<input type="email" autoComplete="email" value={profile.email} onChange={(event) => update('email', event.target.value)} placeholder="you@example.com" /></label>
              <label className="field">Phone<input autoComplete="tel" maxLength={40} value={profile.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone number" /></label>
              <label className="field">Target role<input maxLength={120} value={profile.targetRole} onChange={(event) => update('targetRole', event.target.value)} placeholder="Python Developer" /></label>
              <label className="field">Preferred location<input maxLength={120} value={profile.location} onChange={(event) => update('location', event.target.value)} placeholder="Remote, Bengaluru…" /></label>
              <label className="field">Years of experience<input type="number" min="0" max="80" step="0.5" value={profile.experienceYears ?? ''} onChange={(event) => update('experienceYears', event.target.value === '' ? null : Number(event.target.value))} placeholder="Not specified" /></label>
              <label className="field field-full">Skills<input value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="Python, SQL, FastAPI" /><span className="card-description">Separate skills with commas. Only list skills you can substantiate.</span></label>
            </div>
            <div className="form-actions"><button className="button button-primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save profile'}</button><span className="card-description">Your profile is not sent to an AI provider.</span></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            {notice && <p className="form-success" role="status">{notice}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
