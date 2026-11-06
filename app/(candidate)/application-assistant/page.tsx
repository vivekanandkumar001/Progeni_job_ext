'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listApplicationWorkspaces,
  getApplicationWorkspace,
  createApplicationWorkspace,
  updateApplicationWorkspace,
  generateWorkspaceResume,
  generateWorkspaceCoverLetter,
  generateWorkspaceAnswers,
  approveWorkspace,
  revokeWorkspaceApproval,
  exportWorkspaceBundle,
  type ApplicationWorkspaceRecord,
} from '../../../lib/api';

type Tab = 'overview' | 'resume' | 'cover_letter' | 'screening' | 'fields';

export default function ApplicationAssistantPage() {
  const [workspaces, setWorkspaces] = useState<ApplicationWorkspaceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [current, setCurrent] = useState<ApplicationWorkspaceRecord | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Cover letter controls
  const [clTone, setClTone] = useState<'professional' | 'concise' | 'technical' | 'enthusiastic'>('professional');
  const [clCustomPrompt, setClCustomPrompt] = useState('');
  const [clContent, setClContent] = useState('');

  // Screening questions controls
  const [newQuestionText, setNewQuestionText] = useState('');

  // Human approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [digitalSignatureInput, setDigitalSignatureInput] = useState('');

  // Export state
  const [exportNotice, setExportNotice] = useState('');

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces(autoSelectId?: string) {
    setLoading(true);
    setError('');
    try {
      const res = await listApplicationWorkspaces({ limit: 50 });
      setWorkspaces(res.applications || []);
      const toSelect = autoSelectId || (res.applications && res.applications[0]?.id) || '';
      setSelectedId(toSelect);
      if (toSelect) {
        await loadWorkspaceDetails(toSelect);
      } else {
        setCurrent(null);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load application workspaces.');
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspaceDetails(id: string) {
    setBusy(true);
    setError('');
    try {
      const ws = await getApplicationWorkspace(id);
      setCurrent(ws);
      setClTone(ws.coverLetter?.tone || 'professional');
      setClContent(ws.coverLetter?.content || '');
      setClCustomPrompt(ws.coverLetter?.customInstructions || '');
    } catch (err: any) {
      setError(err.message || 'Could not load workspace details.');
    } finally {
      setBusy(false);
    }
  }

  function handleSelectChange(id: string) {
    setSelectedId(id);
    if (id) {
      void loadWorkspaceDetails(id);
    } else {
      setCurrent(null);
    }
  }

  async function handleRegenerateResume() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await generateWorkspaceResume(current.id);
      setCurrent(updated);
      setNotice('Targeted resume snapshot regenerated and aligned with job requirements.');
    } catch (err: any) {
      setError(err.message || 'Could not tailor resume.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerateCoverLetter() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await generateWorkspaceCoverLetter(current.id, {
        tone: clTone,
        customInstructions: clCustomPrompt,
      });
      setCurrent(updated);
      setClContent(updated.coverLetter.content);
      setNotice(`Cover letter version ${updated.coverLetter.version} generated successfully.`);
    } catch (err: any) {
      setError(err.message || 'Could not regenerate cover letter.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCoverLetter() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateApplicationWorkspace(current.id, {
        coverLetter: {
          ...current.coverLetter,
          content: clContent,
          tone: clTone,
          customInstructions: clCustomPrompt,
        },
      });
      setCurrent(updated);
      setNotice('Cover letter changes saved.');
    } catch (err: any) {
      setError(err.message || 'Could not save cover letter.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAnswerApproval(answerId: string) {
    if (!current) return;
    const updatedAnswers = current.screeningAnswers.map((a) =>
      a.id === answerId ? { ...a, userApproved: !a.userApproved } : a,
    );
    try {
      const updated = await updateApplicationWorkspace(current.id, {
        screeningAnswers: updatedAnswers,
      });
      setCurrent(updated);
    } catch (err: any) {
      setError(err.message || 'Could not update answer approval.');
    }
  }

  async function handleAnswerTextChange(answerId: string, text: string) {
    if (!current) return;
    const updatedAnswers = current.screeningAnswers.map((a) =>
      a.id === answerId ? { ...a, answer: text } : a,
    );
    setCurrent({ ...current, screeningAnswers: updatedAnswers });
  }

  async function handleSaveAnswers() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateApplicationWorkspace(current.id, {
        screeningAnswers: current.screeningAnswers,
      });
      setCurrent(updated);
      setNotice('Screening answers saved and readiness score updated.');
    } catch (err: any) {
      setError(err.message || 'Could not save screening answers.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCustomQuestion() {
    if (!current || !newQuestionText.trim()) return;
    setBusy(true);
    setError('');
    try {
      const updated = await generateWorkspaceAnswers(current.id, [
        ...current.screeningAnswers.map((a) => a.question),
        newQuestionText.trim(),
      ]);
      setCurrent(updated);
      setNewQuestionText('');
      setNotice('Added new screening question and generated grounded answer.');
    } catch (err: any) {
      setError(err.message || 'Could not add screening question.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFieldApproval(fieldId: string) {
    if (!current) return;
    const updatedFields = current.fieldMappings.map((f) =>
      f.id === fieldId ? { ...f, approved: !f.approved } : f,
    );
    try {
      const updated = await updateApplicationWorkspace(current.id, {
        fieldMappings: updatedFields,
      });
      setCurrent(updated);
    } catch (err: any) {
      setError(err.message || 'Could not update field mapping.');
    }
  }

  async function handleFieldValueChange(fieldId: string, val: string) {
    if (!current) return;
    const updatedFields = current.fieldMappings.map((f) =>
      f.id === fieldId ? { ...f, value: val } : f,
    );
    setCurrent({ ...current, fieldMappings: updatedFields });
  }

  async function handleSaveFields() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateApplicationWorkspace(current.id, {
        fieldMappings: current.fieldMappings,
      });
      setCurrent(updated);
      setNotice('Form field mappings saved and readiness score updated.');
    } catch (err: any) {
      setError(err.message || 'Could not save field mappings.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveApplication() {
    if (!current) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await approveWorkspace(current.id, digitalSignatureInput.trim() || undefined);
      setCurrent(updated);
      setShowApprovalModal(false);
      setNotice('Application explicitly approved! Digital audit signature recorded.');
    } catch (err: any) {
      setError(err.message || 'Could not approve application.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeApproval() {
    if (!current) return;
    if (!window.confirm('Are you sure you want to revoke your explicit approval for this application?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const updated = await revokeWorkspaceApproval(current.id, 'Candidate revoked approval via dashboard.');
      setCurrent(updated);
      setNotice('Application approval revoked.');
    } catch (err: any) {
      setError(err.message || 'Could not revoke approval.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format: 'json' | 'markdown' | 'text') {
    if (!current) return;
    setBusy(true);
    setExportNotice('');
    try {
      const res = await exportWorkspaceBundle(current.id, format);
      const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportNotice(`Exported ${res.filename} successfully.`);
    } catch (err: any) {
      setError(err.message || 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied to clipboard.`);
    } catch {
      setError('Clipboard permission denied.');
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider">
              Phase 6 Subsystem
            </span>
            <span className="text-xs text-on-surface-variant font-mono">Zero Hallucination Guarantee</span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mt-1">AI Application Assistant</h1>
          <p className="text-sm text-on-surface-variant">
            Convert matched opportunities into grounded, personalized, candidate-verified application packages.
          </p>
        </div>

        {/* Opportunity Selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-on-surface flex items-center gap-2">
            Opportunity:
            <select
              value={selectedId}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="bg-surface-variant/40 border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Select an application…</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.jobSnapshot.title} · {ws.jobSnapshot.company} ({ws.readiness?.score || 0}%)
                </option>
              ))}
            </select>
          </label>

          <Link
            href="/job-recommendations"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-variant text-on-surface hover:bg-surface-variant/80 border border-outline-variant"
          >
            Find more jobs
          </Link>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-error-container/40 border border-error/30 text-error rounded-lg text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-secondary-container/40 border border-secondary/30 text-secondary rounded-lg text-sm flex items-center justify-between">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice('')} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}
      {exportNotice && (
        <div className="p-3 bg-primary-container/40 border border-primary/30 text-primary rounded-lg text-sm flex items-center justify-between">
          <span>📦 {exportNotice}</span>
          <button onClick={() => setExportNotice('')} className="text-xs font-bold underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-on-surface-variant text-sm">
          Loading application workspace details…
        </div>
      ) : !current ? (
        <div className="p-12 text-center bg-surface-variant/20 rounded-xl border border-outline-variant/30">
          <p className="text-base font-semibold text-on-surface">No Application Workspace Selected</p>
          <p className="text-sm text-on-surface-variant mt-1">
            Choose an active job from the selector above, or discover new opportunities in the jobs dashboard.
          </p>
          <div className="mt-4">
            <Link
              href="/job-recommendations"
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 inline-block"
            >
              Explore Discovered Jobs
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Opportunity Banner & Readiness Summary */}
          <section className="bg-surface rounded-xl border border-outline-variant/40 p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-on-surface">{current.jobSnapshot.title}</h2>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">
                    {current.jobSnapshot.platform || 'Direct ATS'}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ current.status === 'prepared' ? 'bg-success-container text-success' : current.status === 'submitted' ? 'bg-info-container text-info' : 'bg-warning-container text-warning' }`}}>
                    Status: {current.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  <strong>{current.jobSnapshot.company}</strong> · {current.jobSnapshot.location}
                  {current.jobSnapshot.workplaceMode ? ` (${current.jobSnapshot.workplaceMode})` : ''}
                  {current.jobSnapshot.salary ? ` · ${current.jobSnapshot.salary}` : ''}
                </p>
              </div>

              {/* Match Score & Export */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black text-primary">
                    {current.matchSnapshot.score}%
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ current.matchSnapshot.eligible ? 'bg-success-container text-success' : 'bg-warning-container text-warning' }`}}>
                    {current.matchSnapshot.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div className="h-8 w-px bg-outline-variant/40 mx-1" />

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-on-surface-variant font-medium">Export Bundle</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleExport('markdown')}
                      disabled={busy}
                      className="px-2 py-1 text-xs font-medium rounded bg-surface-variant hover:bg-surface-variant/80 border border-outline-variant"
                    >
                      MD
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      disabled={busy}
                      className="px-2 py-1 text-xs font-medium rounded bg-surface-variant hover:bg-surface-variant/80 border border-outline-variant"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => handleExport('text')}
                      disabled={busy}
                      className="px-2 py-1 text-xs font-medium rounded bg-surface-variant hover:bg-surface-variant/80 border border-outline-variant"
                    >
                      TXT
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Readiness Gauge */}
            <div className="bg-surface-variant/20 rounded-lg p-4 border border-outline-variant/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">Application Technical Readiness:</span>
                  <span className="text-base font-black text-primary">{current.readiness.score}/100</span>
                  <span className="text-xs text-on-surface-variant">({current.readiness.summary})</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ current.readiness.isReadyForSubmission ? 'bg-success-container text-success' : 'bg-warning-container text-warning' }`}}>
                  {current.readiness.isReadyForSubmission ? 'READY FOR SUBMISSION' : 'PREPARATION IN PROGRESS'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-outline-variant/30 rounded-full h-2.5 overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-300 ${ current.readiness.score >= 90 ? 'bg-emerald-500' : current.readiness.score >= 60 ? 'bg-primary' : 'bg-amber-500' }`}}
                  style={{ width: `${current.readiness.score}%` }}
                />
              </div>

              {/* 6 Dimension Badges */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-3 pt-3 border-t border-outline-variant/20 text-xs">
                <div>
                  <span className="text-on-surface-variant block">Resume</span>
                  <strong className={current.readiness.breakdown.resume.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.resume.score}/20 pts
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Cover Letter</span>
                  <strong className={current.readiness.breakdown.coverLetter.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.coverLetter.score}/15 pts
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Screening Q&A</span>
                  <strong className={current.readiness.breakdown.screeningQuestions.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.screeningQuestions.score}/25 pts
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Form Mappings</span>
                  <strong className={current.readiness.breakdown.formFields.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.formFields.score}/20 pts
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Integrity</span>
                  <strong className={current.readiness.breakdown.missingInfo.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.missingInfo.score}/10 pts
                  </strong>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Human Gate</span>
                  <strong className={current.readiness.breakdown.humanApproval.ready ? 'text-success' : 'text-warning'}>
                    {current.readiness.breakdown.humanApproval.score}/10 pts
                  </strong>
                </div>
              </div>
            </div>

            {/* Human Approval Gate Bar */}
            <div className={`p-4 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3 ${ current.approval.isApproved ? 'bg-success-container/60 border-success/30 text-success' : 'bg-warning-container/60 border-warning/30 text-warning' }`}}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{current.approval.isApproved ? '🛡️' : '⚠️'}</span>
                <div>
                  <p className="text-sm font-bold">
                    {current.approval.isApproved
                      ? 'Human Approval Granted — Ready for Manual or Extension Autofill'
                      : 'Explicit Human Approval Required'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90">
                    {current.approval.isApproved
                      ? `Digitally confirmed by candidate on ${new Date(current.approval.approvedAt!).toLocaleString()} (Signature: ${current.approval.approvalSignature?.slice(0, 16)}...)`
                      : 'Product Invariant: You must review tailored assets and provide explicit confirmation prior to application submission or autofill injection.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {current.approval.isApproved ? (
                  <button
                    onClick={handleRevokeApproval}
                    disabled={busy}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-error/10 text-error hover:bg-error/20 border border-error/30"
                  >
                    Revoke Approval
                  </button>
                ) : (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    disabled={busy}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 shadow-sm"
                  >
                    Review & Explicitly Approve
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex border-b border-outline-variant/30 gap-2">
            {[
              { id: 'overview', label: '1. Overview & Checklist', icon: '📋' },
              { id: 'resume', label: '2. Resume Tailoring', icon: '📄' },
              { id: 'cover_letter', label: '3. Cover Letter Studio', icon: '✉️' },
              { id: 'screening', label: '4. Screening Q&A', icon: '❓' },
              { id: 'fields', label: '5. Form Field Mappings', icon: '📝' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${ activeTab === tab.id ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface' }`}}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Overview & Checklist */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Actionable Checklist */}
              <div className="md:col-span-2 bg-surface rounded-xl border border-outline-variant/30 p-5 space-y-4">
                <h3 className="text-base font-bold text-on-surface">Application Readiness Checklist</h3>
                <div className="space-y-2">
                  {current.readiness.checklist.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border text-sm flex items-center justify-between ${ item.ready ? 'bg-surface border-success/30' : 'bg-surface-variant/20 border-outline-variant/40' }`}}
                    >
                      <div className="flex items-center gap-3">
                        <span className={item.ready ? 'text-success font-bold' : 'text-warning'}>
                          {item.ready ? '✓' : '○'}
                        </span>
                        <div>
                          <strong className="text-on-surface">{item.item}</strong>
                          <span className="text-xs text-on-surface-variant block">Category: {item.category}</span>
                          {item.actionRequired && (
                            <span className="text-xs text-warning font-medium block mt-0.5">
                              Action: {item.actionRequired}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                        {item.points}/{item.maxPoints} pts
                      </span>
                    </div>
                  ))}
                </div>

                {/* Missing Information Alerts */}
                {current.missingInformation.length > 0 && (
                  <div className="p-4 bg-warning-container rounded-lg border border-warning/30 text-warning text-sm mt-4">
                    <strong className="block font-semibold mb-1">Missing Information Warnings:</strong>
                    <ul className="list-disc list-inside space-y-0.5 text-xs">
                      {current.missingInformation.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Job Summary & Audit Trail */}
              <div className="space-y-6">
                <div className="bg-surface rounded-xl border border-outline-variant/30 p-5 space-y-3">
                  <h3 className="text-base font-bold text-on-surface">Target Job Highlights</h3>
                  <div className="text-xs space-y-2 text-on-surface-variant">
                    <p><strong>Application URL:</strong> <a href={current.jobSnapshot.url} target="_blank" rel="noreferrer" className="text-primary underline truncate block">{current.jobSnapshot.url}</a></p>
                    <p><strong>Required Skills:</strong> {current.jobSnapshot.requiredSkills.join(', ') || 'General qualifications'}</p>
                    {current.jobSnapshot.description && (
                      <div>
                        <strong>Job Excerpt:</strong>
                        <p className="mt-1 p-2 bg-surface-variant/20 rounded text-xs line-clamp-4">
                          {current.jobSnapshot.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audit Trail */}
                <div className="bg-surface rounded-xl border border-outline-variant/30 p-5 space-y-3">
                  <h3 className="text-base font-bold text-on-surface">Action Audit Log</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                    {current.approval.auditTrail.map((log, index) => (
                      <div key={index} className="p-2 rounded bg-surface-variant/20 border border-outline-variant/20">
                        <div className="flex justify-between font-semibold text-on-surface">
                          <span>{log.action.toUpperCase()}</span>
                          <span className="text-on-surface-variant">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-on-surface-variant mt-0.5">{log.details}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Resume Tailoring */}
          {activeTab === 'resume' && (
            <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Grounded Resume Tailoring</h3>
                  <p className="text-sm text-on-surface-variant">
                    Reorders verified experiences and prioritizes matching skills without fabricating qualifications.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRegenerateResume}
                    disabled={busy}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:opacity-90"
                  >
                    {busy ? 'Tailoring…' : 'Regenerate Tailored Resume'}
                  </button>
                  <Link
                    href="/resume-studio"
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-surface-variant text-on-surface border border-outline-variant hover:bg-surface-variant/80"
                  >
                    Open Resume Studio
                  </Link>
                </div>
              </div>

              {current.targetedResumeSnapshot ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tailored Profile Summary */}
                  <div className="p-4 rounded-xl border border-outline-variant/40 bg-surface-variant/10 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">Tailored Summary</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-success-container text-success">
                        {current.targetedResumeSnapshot.alignmentScore}% Job Alignment
                      </span>
                    </div>
                    <p className="text-sm text-on-surface leading-relaxed">
                      {current.targetedResumeSnapshot.summary}
                    </p>
                    <button
                      onClick={() => copyToClipboard(current.targetedResumeSnapshot!.summary, 'Tailored summary')}
                      className="text-xs text-primary font-semibold underline"
                    >
                      Copy Summary
                    </button>
                  </div>

                  {/* Prioritized Verified Skills */}
                  <div className="p-4 rounded-xl border border-outline-variant/40 bg-surface-variant/10 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">Prioritized Skills (Grounded)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {current.targetedResumeSnapshot.skills.map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs rounded-full bg-surface border border-outline-variant font-medium text-on-surface">
                          ✓ {skill}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2">
                      All displayed skills derived strictly from candidate verified profile and master resume.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-surface-variant/20 rounded-xl border border-outline-variant/40">
                  <p className="text-sm font-medium text-on-surface">No tailored snapshot generated yet.</p>
                  <button
                    onClick={handleRegenerateResume}
                    disabled={busy}
                    className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-on-primary hover:opacity-90"
                  >
                    Generate Targeted Resume Snapshot
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Cover Letter Studio */}
          {activeTab === 'cover_letter' && (
            <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Role-Grounded Cover Letter</h3>
                  <p className="text-sm text-on-surface-variant">
                    Generated strictly from your verified achievements, genuine experience bullets, and the job description.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(clContent, 'Cover letter')}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-surface-variant text-on-surface hover:bg-surface-variant/80 border border-outline-variant"
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={handleSaveCoverLetter}
                    disabled={busy}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-primary text-on-primary hover:opacity-90"
                  >
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Tone & Prompt Customizer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-surface-variant/10 border border-outline-variant/30">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                    Tone Preset:
                  </label>
                  <select
                    value={clTone}
                    onChange={(e) => setClTone(e.target.value as any)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-medium outline-none"
                  >
                    <option value="professional">Professional (Structured & Direct)</option>
                    <option value="concise">Concise (High-Density / Bullets)</option>
                    <option value="technical">Technical (Architecture & Stack Depth)</option>
                    <option value="enthusiastic">Enthusiastic (Mission & Growth Focus)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                    Custom Focus Instructions:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Emphasize my experience building distributed Kafka pipelines"
                      value={clCustomPrompt}
                      onChange={(e) => setClCustomPrompt(e.target.value)}
                      className="flex-1 bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm outline-none"
                    />
                    <button
                      onClick={handleRegenerateCoverLetter}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>

              {/* Cover Letter Editor */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs text-on-surface-variant">
                  <span>Version: {current.coverLetter.version} · Tone: {current.coverLetter.tone}</span>
                  <span>{clContent.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <textarea
                  rows={14}
                  value={clContent}
                  onChange={(e) => setClContent(e.target.value)}
                  className="w-full font-mono text-sm p-4 bg-surface rounded-xl border border-outline-variant/60 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          )}

          {/* Tab 4: Screening Questions & Answers */}
          {activeTab === 'screening' && (
            <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Screening Question Assistant</h3>
                  <p className="text-sm text-on-surface-variant">
                    Answers grounded in your verified profile. Factual accuracy guaranteed: legal and financial questions require candidate attestation.
                  </p>
                </div>

                <button
                  onClick={handleSaveAnswers}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 self-start"
                >
                  Save & Confirm Answers
                </button>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {current.screeningAnswers.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-colors ${ item.userApproved ? 'bg-surface border-success/30' : 'bg-surface-variant/10 border-outline-variant/40' }`}}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-on-surface text-sm">{item.question}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant font-mono">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-on-surface-variant">
                          Confidence: <strong>{(item.confidence * 100).toFixed(0)}%</strong>
                        </span>

                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.userApproved}
                            onChange={() => handleToggleAnswerApproval(item.id)}
                            className="rounded"
                          />
                          <span className={item.userApproved ? 'text-success' : 'text-on-surface-variant'}>
                            {item.userApproved ? 'Candidate Approved' : 'Needs Approval'}
                          </span>
                        </label>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={item.answer || ''}
                      onChange={(e) => handleAnswerTextChange(item.id, e.target.value)}
                      placeholder="Candidate attestation or answer text…"
                      className="w-full text-sm p-3 bg-surface rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none"
                    />

                    {item.sourceEvidence && (
                      <p className="text-xs text-on-surface-variant mt-1.5">
                        🔍 <strong>Source Evidence:</strong> {item.sourceEvidence}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Custom Question */}
              <div className="p-4 rounded-xl bg-surface-variant/20 border border-outline-variant/30 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Add Specific Question From Job Board:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Do you have experience with Kubernetes in production?"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="flex-1 bg-surface border border-outline-variant rounded-lg px-3 py-1.5 text-sm outline-none"
                  />
                  <button
                    onClick={handleAddCustomQuestion}
                    disabled={busy || !newQuestionText.trim()}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-50"
                  >
                    Analyze & Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Form Field Mappings */}
          {activeTab === 'fields' && (
            <div className="bg-surface rounded-xl border border-outline-variant/30 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Application Form Field Mappings</h3>
                  <p className="text-sm text-on-surface-variant">
                    Configures field mapping for Chrome Extension smart autofill. You approve each field value individually.
                  </p>
                </div>

                <button
                  onClick={handleSaveFields}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 self-start"
                >
                  Save Form Mappings
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-xs text-on-surface-variant uppercase tracking-wider">
                      <th className="py-2.5 px-3">Field</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Mapped Value</th>
                      <th className="py-2.5 px-3">Selector</th>
                      <th className="py-2.5 px-3 text-center">Approved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {current.fieldMappings.map((field) => (
                      <tr key={field.id} className="hover:bg-surface-variant/10">
                        <td className="py-3 px-3 font-semibold text-on-surface">
                          {field.label} {field.required ? <span className="text-error">*</span> : ''}
                        </td>
                        <td className="py-3 px-3 text-xs text-on-surface-variant">{field.source}</td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={field.value}
                            onChange={(e) => handleFieldValueChange(field.id, e.target.value)}
                            className="w-full bg-surface border border-outline-variant rounded px-2.5 py-1 text-sm outline-none"
                          />
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-on-surface-variant truncate max-w-xs">
                          {field.selector || 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={field.approved}
                            onChange={() => handleToggleFieldApproval(field.id)}
                            className="rounded"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Human Approval Confirmation Modal */}
      {showApprovalModal && current && (
        <div className="fixed inset-0 bg-surface backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-outline-variant space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Human Approval Gate</span>
              <h3 className="text-xl font-bold text-on-surface mt-0.5">Explicit Application Confirmation</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Please verify the application bundle details before granting explicit authorization.
              </p>
            </div>

            <div className="p-4 bg-surface-variant/20 rounded-xl space-y-2 text-xs border border-outline-variant/30">
              <p><strong>Target Role:</strong> {current.jobSnapshot.title}</p>
              <p><strong>Company:</strong> {current.jobSnapshot.company}</p>
              <p><strong>Application URL:</strong> <span className="text-primary truncate block">{current.jobSnapshot.url}</span></p>
              <p><strong>Resume Version:</strong> {current.targetedResumeSnapshot?.title || 'Master Resume'}</p>
              <p><strong>Cover Letter:</strong> Included ({current.coverLetter.tone} tone, {current.coverLetter.content.length} chars)</p>
              <p><strong>Screening Answers Approved:</strong> {current.screeningAnswers.filter((a) => a.userApproved).length}/{current.screeningAnswers.length}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-on-surface block mb-1">
                Digital Confirmation Signature:
              </label>
              <input
                type="text"
                placeholder="Type your full legal name to sign approval"
                value={digitalSignatureInput}
                onChange={(e) => setDigitalSignatureInput(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg p-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-xs text-on-surface-variant mt-1 block">
                A cryptographic audit hash will be permanently recorded in your application history.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/30">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-on-surface hover:bg-surface-variant"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveApplication}
                disabled={busy}
                className="px-5 py-2 text-sm font-bold rounded-lg bg-primary text-on-primary hover:opacity-90 shadow-md"
              >
                {busy ? 'Signing…' : 'I Authorize & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
