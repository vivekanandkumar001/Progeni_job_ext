'use client';

import Link from 'next/link';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  analyzeResume,
  deleteResume,
  getProfile,
  getResumes,
  saveResume,
  type CandidateProfile,
  type ResumeAnalysis,
  type ResumeRecord,
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export default function ResumeManagerPage() {
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadData() {
    const [savedProfile, savedResumes] = await Promise.all([getProfile(), getResumes()]);
    setProfile(savedProfile ?? emptyProfile);
    setResumes(savedResumes);
  }

  useEffect(() => {
    void loadData().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load resume data.');
    }).finally(() => setLoading(false));
  }, []);

  function updateProfile<K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setAnalysis(null);
    setError('');
    setNotice('');
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    if (extension !== 'pdf' && extension !== 'docx' && extension !== 'txt') {
      setError('Choose a PDF, DOCX, or UTF-8 text file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Resume files must be 5 MB or smaller.');
      return;
    }
    if (file.size === 0) {
      setError('The selected file is empty.');
      return;
    }

    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await analyzeResume(file.name, extension, toBase64(bytes));
      setAnalysis(result);
      setSelectedSkills(result.skills.map((item) => item.skill));
      setProfile((current) => ({
        ...current,
        fullName: result.detected.fullName ?? current.fullName,
        email: result.detected.email ?? current.email,
        phone: result.detected.phone ?? current.phone,
        experienceYears: result.detected.experienceYears ?? current.experienceYears,
      }));
      setNotice('Review every suggested field and skill before adding it to your profile.');
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Could not read this resume.');
    } finally {
      setBusy(false);
    }
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((current) => current.includes(skill)
      ? current.filter((value) => value !== skill)
      : [...current, skill]);
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysis) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const skills = [...new Set([...profile.skills, ...selectedSkills])];
      const savedProfile = await saveResume(
        {
          fileName: analysis.fileName,
          fileType: analysis.fileType,
          skills: analysis.skills.filter((item) => selectedSkills.includes(item.skill)),
          experienceYears: analysis.detected.experienceYears,
          experienceEvidence: analysis.detected.experienceEvidence,
        },
        { ...profile, skills },
      );
      setResumes((current) => [savedProfile, ...current]);
      setProfile((current) => ({ ...current, skills }));
      setAnalysis(null);
      setSelectedSkills([]);
      setNotice('Reviewed details and skill evidence were added to your workspace. The uploaded file was not saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save reviewed resume details.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(resume: ResumeRecord) {
    if (!window.confirm(`Remove extracted evidence from ${resume.fileName}?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteResume(resume.id);
      setResumes((current) => current.filter((item) => item.id !== resume.id));
      setNotice('Resume evidence was removed. Candidate-confirmed profile skills remain unchanged.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove resume evidence.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="page-heading">
        <div>
          <p className="eyebrow">EVIDENCE-BASED PROFILE</p>
          <h1>Resume intelligence</h1>
          <p>Extract profile suggestions and short skill evidence. You review every detail before it is saved.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link className="button button-primary" href="/resume-studio">Open Resume Studio</Link>
          <Link className="button button-secondary" href="/resume-analyzer">ATS Diagnostics</Link>
          <Link className="button button-secondary" href="/targeted-resume">Targeted Generator</Link>
          <Link className="button button-secondary" href="/truth-engine">Truth Claims</Link>
        </div>
      </header>

      <section className="card card-padding resume-upload-card">
        <div className="resume-upload-heading">
          <div>
            <h2 className="card-title">Analyze a resume</h2>
            <p className="card-description">PDF, DOCX, or UTF-8 text · up to 5 MB · parsed by the Progeni API, not an AI service</p>
          </div>
          <label className="button button-primary resume-file-button">
            {busy ? 'Working…' : 'Choose resume'}
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              disabled={busy || loading}
              onChange={(event) => void handleFileChange(event)}
            />
          </label>
        </div>
        <p className="notice">
          The selected file and extracted text are sent to the Progeni API for parsing and are not retained there.
          Only details you confirm and short skill-evidence snippets are saved in your workspace.
        </p>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-success" role="status">{notice}</p>}
      </section>

      {analysis && (
        <section className="card card-padding resume-review-card">
          <div className="page-heading resume-review-heading">
            <div>
              <h2 className="card-title">Review extracted details</h2>
              <p className="card-description">{analysis.fileName} · extraction status: {analysis.status.replace('_', ' ')}</p>
            </div>
          </div>
          {analysis.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
          <form onSubmit={(event) => void handleConfirm(event)}>
            <div className="form-grid">
              <label className="field">Full name<input maxLength={120} value={profile.fullName} onChange={(event) => updateProfile('fullName', event.target.value)} /></label>
              <label className="field">Email<input type="email" value={profile.email} onChange={(event) => updateProfile('email', event.target.value)} /></label>
              <label className="field">Phone<input maxLength={40} value={profile.phone} onChange={(event) => updateProfile('phone', event.target.value)} /></label>
              <label className="field">Years of experience<input type="number" min="0" max="80" step="0.5" value={profile.experienceYears ?? ''} onChange={(event) => updateProfile('experienceYears', event.target.value === '' ? null : Number(event.target.value))} /><span className="card-description">Review the profile value. Resume evidence is saved only when an explicit experience statement was detected.</span></label>
            </div>
            <div className="resume-skills">
              <h3>Skill evidence suggestions</h3>
              <p className="card-description">Select only skills supported by the resume. Evidence is the matching line, not an independent verification.</p>
              {analysis.skills.length === 0 ? (
                <p className="empty-state">No catalog skills were detected. You can still confirm the reviewed profile details.</p>
              ) : (
                <ul className="resume-skill-list">
                  {analysis.skills.map((item) => (
                    <li key={item.skill}>
                      <label>
                        <input type="checkbox" checked={selectedSkills.includes(item.skill)} onChange={() => toggleSkill(item.skill)} />
                        <span><strong>{item.skill}</strong><span className="resume-evidence">{item.evidence}</span></span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {analysis.detected.experienceEvidence && (
              <p className="card-description resume-experience-evidence">
                Experience evidence found: “{analysis.detected.experienceEvidence}”. Check the extracted estimate before saving.
              </p>
            )}
            <div className="form-actions">
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm details and add evidence'}</button>
              <button className="button button-secondary" type="button" disabled={busy} onClick={() => setAnalysis(null)}>Discard suggestions</button>
            </div>
          </form>
        </section>
      )}

      <section className="card card-padding resume-list-card">
        <div className="page-heading resume-review-heading">
          <div><h2 className="card-title">Confirmed resume evidence</h2><p className="card-description">Only reviewed structured details and short skill snippets are kept.</p></div>
          <span className="local-pill"><span className="online-dot" /> WORKSPACE DATA</span>
        </div>
        {loading ? <p className="empty-state">Loading confirmed evidence…</p> : resumes.length === 0 ? (
          <p className="empty-state">No resume evidence saved. Choose a resume to get started.</p>
        ) : (
          <ul className="resume-record-list">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <div>
                  <strong>{resume.fileName}</strong>
                  <span>{resume.skills.length} skill evidence item{resume.skills.length === 1 ? '' : 's'} · {new Date(resume.createdAt).toLocaleDateString()}</span>
                  {resume.skills.length > 0 && <span>{resume.skills.map((item) => item.skill).join(', ')}</span>}
                </div>
                <button className="button button-secondary" type="button" disabled={busy} onClick={() => void handleDelete(resume)}>Remove evidence</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
