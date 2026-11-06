'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getMasterResume,
  listStudioResumes,
  getStudioResume,
  updateStudioResume,
  publishStudioResume,
  restoreStudioResume,
  duplicateStudioResume,
  downloadResumeFile,
  type ResumeStudioData,
  type ResumeStudioWorkExperience,
  type ResumeStudioEducation,
} from '../../../lib/api';

export default function ResumeStudioPage() {
  const [resumes, setResumes] = useState<ResumeStudioData[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeStudioData | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'personal' | 'summary' | 'experience' | 'education' | 'skills' | 'sections' | 'history'>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Load master resume and all candidate resumes
  async function loadResumes() {
    try {
      setLoading(true);
      const [master, list] = await Promise.all([
        getMasterResume(),
        listStudioResumes(),
      ]);

      const all = list.length ? list : [master];
      setResumes(all);
      const current = all.find((r) => r.id === selectedResumeId) || master;
      setActiveResume(current);
      setSelectedResumeId(current.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load resumes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResumes();
  }, []);

  async function handleSelectResume(id: string) {
    setSelectedResumeId(id);
    try {
      const resume = await getStudioResume(id);
      setActiveResume(resume);
      setNotice('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load resume.');
    }
  }

  async function handleSaveDraft() {
    if (!activeResume) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateStudioResume(activeResume.id, {
        title: activeResume.title,
        template: activeResume.template,
        section_order: activeResume.section_order,
        content: activeResume.content,
      });
      setActiveResume(updated);
      setNotice('Draft saved successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save draft.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!activeResume) return;
    setSaving(true);
    setError('');
    try {
      const published = await publishStudioResume(activeResume.id, `Published version ${activeResume.version + 1}`);
      setActiveResume(published);
      setNotice(`Version ${published.version} published.`);
      void loadResumes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate() {
    if (!activeResume) return;
    setSaving(true);
    try {
      const dup = await duplicateStudioResume(activeResume.id, `${activeResume.title} (Variant)`);
      setNotice('Resume duplicated as new draft variant.');
      await loadResumes();
      setSelectedResumeId(dup.id);
      setActiveResume(dup);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(targetVersion: number) {
    if (!activeResume) return;
    setSaving(true);
    try {
      const restored = await restoreStudioResume(activeResume.id, targetVersion);
      setActiveResume(restored);
      setNotice(`Restored content from version ${targetVersion}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to restore version.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: 'pdf' | 'docx') {
    if (!activeResume) return;
    try {
      setNotice(`Preparing ${format.toUpperCase()} export...`);
      await downloadResumeFile(activeResume.id, format, activeResume.title);
      setNotice(`${format.toUpperCase()} downloaded successfully.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Could not export ${format.toUpperCase()}.`);
    }
  }

  // Content field mutators
  function updatePersonalInfo<K extends keyof ResumeStudioData['content']['personal_info']>(
    key: K,
    val: ResumeStudioData['content']['personal_info'][K],
  ) {
    if (!activeResume) return;
    setActiveResume({
      ...activeResume,
      content: {
        ...activeResume.content,
        personal_info: {
          ...activeResume.content.personal_info,
          [key]: val,
        },
      },
    });
  }

  function updateSummary(val: string) {
    if (!activeResume) return;
    setActiveResume({
      ...activeResume,
      content: {
        ...activeResume.content,
        summary: val,
      },
    });
  }

  function addWorkExperience() {
    if (!activeResume) return;
    const newExp: ResumeStudioWorkExperience = {
      id: String(Date.now()),
      company: 'New Company',
      role: 'Software Engineer',
      start_date: '2022',
      end_date: 'Present',
      current: true,
      highlights: ['Led engineering initiatives and built critical backend services.'],
    };
    setActiveResume({
      ...activeResume,
      content: {
        ...activeResume.content,
        work_experience: [newExp, ...(activeResume.content.work_experience || [])],
      },
    });
  }

  function updateWorkExperience(idx: number, patch: Partial<ResumeStudioWorkExperience>) {
    if (!activeResume) return;
    const list = [...(activeResume.content.work_experience || [])];
    list[idx] = { ...list[idx], ...patch };
    setActiveResume({
      ...activeResume,
      content: { ...activeResume.content, work_experience: list },
    });
  }

  function removeWorkExperience(idx: number) {
    if (!activeResume) return;
    const list = (activeResume.content.work_experience || []).filter((_, i) => i !== idx);
    setActiveResume({
      ...activeResume,
      content: { ...activeResume.content, work_experience: list },
    });
  }

  function addEducation() {
    if (!activeResume) return;
    const newEdu: ResumeStudioEducation = {
      id: String(Date.now()),
      institution: 'University Name',
      degree: 'B.S.',
      field_of_study: 'Computer Science',
      start_year: 2018,
      end_year: 2022,
    };
    setActiveResume({
      ...activeResume,
      content: {
        ...activeResume.content,
        education: [newEdu, ...(activeResume.content.education || [])],
      },
    });
  }

  function updateEducation(idx: number, patch: Partial<ResumeStudioEducation>) {
    if (!activeResume) return;
    const list = [...(activeResume.content.education || [])];
    list[idx] = { ...list[idx], ...patch };
    setActiveResume({
      ...activeResume,
      content: { ...activeResume.content, education: list },
    });
  }

  function removeEducation(idx: number) {
    if (!activeResume) return;
    const list = (activeResume.content.education || []).filter((_, i) => i !== idx);
    setActiveResume({
      ...activeResume,
      content: { ...activeResume.content, education: list },
    });
  }

  function addSkill(name: string) {
    if (!activeResume || !name.trim()) return;
    const existing = activeResume.content.skills || [];
    if (existing.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) return;
    setActiveResume({
      ...activeResume,
      content: {
        ...activeResume.content,
        skills: [...existing, { name: name.trim(), category: 'technical', is_verified: false }],
      },
    });
  }

  function removeSkill(idx: number) {
    if (!activeResume) return;
    const skills = (activeResume.content.skills || []).filter((_, i) => i !== idx);
    setActiveResume({
      ...activeResume,
      content: { ...activeResume.content, skills },
    });
  }

  function moveSection(idx: number, direction: 'up' | 'down') {
    if (!activeResume) return;
    const sections = [...activeResume.section_order];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const temp = sections[idx];
    sections[idx] = sections[targetIdx];
    sections[targetIdx] = temp;
    setActiveResume({
      ...activeResume,
      section_order: sections,
    });
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-64" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-96" />
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Top Header & Fast Nav */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Phase 3 Live
            </span>
            {activeResume?.is_master && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Master Career Profile
              </span>
            )}
            <span className="text-xs text-slate-700 dark:text-slate-300">
              v{activeResume?.version} ({activeResume?.status})
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Resume Studio & Builder
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Interactive career editor with section reordering, version snapshotting, and ATS-optimized document export.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/resume-analyzer"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            ATS Diagnostics
          </Link>
          <Link
            href="/targeted-resume"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Targeted Generator
          </Link>
          <Link
            href="/truth-engine"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Truth Claims
          </Link>

          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition"
          >
            Export PDF
          </button>
          <button
            onClick={() => handleExport('docx')}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Export Word (.docx)
          </button>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-3 text-sm text-rose-800 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          {notice}
        </div>
      )}

      {/* Resume Selector & Template Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
            Active Resume:
          </label>
          <select
            value={selectedResumeId}
            onChange={(e) => handleSelectResume(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} {r.is_master ? '(Master)' : ''} [v{r.version}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">
            Template:
          </label>
          <select
            value={activeResume?.template || 'modern'}
            onChange={(e) => {
              if (activeResume) {
                setActiveResume({ ...activeResume, template: e.target.value as any });
              }
            }}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white capitalize"
          >
            <option value="modern">Modern Professional</option>
            <option value="classic">Classic Serif</option>
            <option value="technical">Technical Lead</option>
            <option value="executive">Executive Minimal</option>
          </select>

          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
          >
            Publish New Version
          </button>
          <button
            onClick={handleDuplicate}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
          >
            Duplicate
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Editor (Left) & Styled Printable Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Editor Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sub-tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto pb-1 text-sm font-medium">
            {(
              [
                ['personal', 'Identity'],
                ['summary', 'Summary'],
                ['experience', 'Experience'],
                ['education', 'Education'],
                ['skills', 'Skills'],
                ['sections', 'Reorder Sections'],
                ['history', 'Versions'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-3 py-2 border-b-2 whitespace-nowrap transition ${
                  activeTab === tabKey
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab 1: Personal Info */}
          {activeTab === 'personal' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Candidate Identity</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={activeResume.content.personal_info.full_name || ''}
                    onChange={(e) => updatePersonalInfo('full_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={activeResume.content.personal_info.email || ''}
                    onChange={(e) => updatePersonalInfo('email', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={activeResume.content.personal_info.phone || ''}
                    onChange={(e) => updatePersonalInfo('phone', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Role</label>
                  <input
                    type="text"
                    value={activeResume.content.personal_info.target_role || ''}
                    onChange={(e) => updatePersonalInfo('target_role', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    value={activeResume.content.personal_info.city || ''}
                    onChange={(e) => updatePersonalInfo('city', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                  <input
                    type="text"
                    value={activeResume.content.personal_info.country || ''}
                    onChange={(e) => updatePersonalInfo('country', e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Summary */}
          {activeTab === 'summary' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Professional Summary</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                A concise 2-4 sentence executive overview of your core expertise, key achievements, and primary technical disciplines.
              </p>
              <textarea
                rows={5}
                value={activeResume.content.summary || ''}
                onChange={(e) => updateSummary(e.target.value)}
                placeholder="Results-oriented engineer with 6+ years building distributed cloud platforms..."
                className="w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
              />
            </div>
          )}

          {/* Tab 3: Experience */}
          {activeTab === 'experience' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Work Experience</h3>
                <button
                  onClick={addWorkExperience}
                  className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  + Add Experience
                </button>
              </div>

              {(activeResume.content.work_experience || []).map((exp, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Role / Title</label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => updateWorkExperience(idx, { role: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Company</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateWorkExperience(idx, { company: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Accomplishment Bullet Points (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={(exp.highlights || []).join('\n')}
                      onChange={(e) => updateWorkExperience(idx, { highlights: e.target.value.split('\n').filter(Boolean) })}
                      className="w-full p-2.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-transparent font-mono"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => removeWorkExperience(idx)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Delete Entry
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Education */}
          {activeTab === 'education' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Education History</h3>
                <button
                  onClick={addEducation}
                  className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  + Add Degree
                </button>
              </div>

              {(activeResume.content.education || []).map((edu, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Degree</label>
                      <input
                        type="text"
                        value={edu.degree}
                        onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Institution</label>
                      <input
                        type="text"
                        value={edu.institution}
                        onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeEducation(idx)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Delete Degree
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 5: Skills */}
          {activeTab === 'skills' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Technical Skills</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="new-skill-input"
                  placeholder="e.g. Kubernetes, React, Golang"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addSkill((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('new-skill-input') as HTMLInputElement;
                    if (el) {
                      addSkill(el.value);
                      el.value = '';
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(activeResume.content.skills || []).map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {skill.name}
                    {skill.is_verified && <span className="text-emerald-500 text-[10px]">✓</span>}
                    <button
                      onClick={() => removeSkill(idx)}
                      className="hover:text-rose-600 ml-1 text-slate-700 dark:text-slate-300"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tab 6: Section Ordering */}
          {activeTab === 'sections' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Section Ordering</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Adjust how sections appear on the exported document to emphasize your greatest strengths.
              </p>
              <div className="space-y-2">
                {activeResume.section_order.map((sec, idx) => (
                  <div
                    key={sec}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  >
                    <span className="text-sm font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {idx + 1}. {sec}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveSection(idx, 'up')}
                        disabled={idx === 0}
                        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveSection(idx, 'down')}
                        disabled={idx === activeResume.section_order.length - 1}
                        className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 7: Version History */}
          {activeTab === 'history' && activeResume && (
            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Version Timeline & Snapshots</h3>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Every published version is preserved. Restore any previous revision with a single click.
              </p>
              <div className="space-y-3">
                {(activeResume.version_history || []).map((snap, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        Version {snap.version}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        {snap.change_summary} • {new Date(snap.updated_at).toLocaleString()}
                      </div>
                    </div>
                    {snap.version !== activeResume.version && (
                      <button
                        onClick={() => handleRestore(snap.version)}
                        className="px-3 py-1 text-xs font-semibold text-emerald-600 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded transition"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Styled Preview Column (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Live Document Preview
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 capitalize font-mono">
                {activeResume?.template} layout
              </span>
            </div>

            {/* Resume Sheet */}
            <div className={`p-6 text-slate-900 dark:text-slate-100 font-sans space-y-4 max-h-[750px] overflow-y-auto ${
              activeResume?.template === 'classic' ? 'font-serif' : 'font-sans'
            }`}>
              {/* Header */}
              <div className="border-b border-slate-300 dark:border-slate-700 pb-3">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {activeResume?.content.personal_info.full_name || 'Candidate Name'}
                </h2>
                {activeResume?.content.personal_info.target_role && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {activeResume.content.personal_info.target_role}
                  </p>
                )}
                <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">
                  {[
                    activeResume?.content.personal_info.email,
                    activeResume?.content.personal_info.phone,
                    [activeResume?.content.personal_info.city, activeResume?.content.personal_info.country].filter(Boolean).join(', '),
                  ].filter(Boolean).join(' • ')}
                </p>
              </div>

              {/* Sections in dynamic order */}
              {(activeResume?.section_order || []).map((secKey) => {
                if (secKey === 'summary' && activeResume?.content.summary) {
                  return (
                    <div key="summary" className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-0.5">
                        Professional Summary
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {activeResume.content.summary}
                      </p>
                    </div>
                  );
                }

                if (secKey === 'experience' && activeResume?.content.work_experience?.length) {
                  return (
                    <div key="experience" className="space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-0.5">
                        Work Experience
                      </h4>
                      {activeResume.content.work_experience.map((exp, i) => (
                        <div key={i} className="text-xs space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>{exp.role}</span>
                            <span className="text-[11px] text-slate-700 dark:text-slate-300">{exp.company}</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300 text-[11px]">
                            {(exp.highlights || []).map((h, hi) => (
                              <li key={hi}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (secKey === 'skills' && activeResume?.content.skills?.length) {
                  return (
                    <div key="skills" className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-0.5">
                        Technical Skills
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {activeResume.content.skills.map((s) => s.name).join(', ')}
                      </p>
                    </div>
                  );
                }

                if (secKey === 'education' && activeResume?.content.education?.length) {
                  return (
                    <div key="education" className="space-y-1">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-0.5">
                        Education
                      </h4>
                      {activeResume.content.education.map((edu, i) => (
                        <div key={i} className="text-xs flex justify-between">
                          <span className="font-medium">{edu.degree} - {edu.institution}</span>
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">{edu.end_year}</span>
                        </div>
                      ))}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

