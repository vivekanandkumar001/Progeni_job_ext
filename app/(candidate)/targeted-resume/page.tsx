'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  generateTargetedResume,
  type TargetedResumeResult,
} from '../../../lib/api';

export default function TargetedResumePage() {
  const router = useRouter();
  const [jobDescription, setJobDescription] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TargetedResumeResult | null>(null);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setError('Please provide a complete job description (at least 20 characters).');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await generateTargetedResume({
        jobDescription,
        targetRole: targetRole.trim() || undefined,
        targetCompany: targetCompany.trim() || undefined,
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Targeted generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-container text-primary">
              Zero-Hallucination Tailoring
            </span>
            <span className="text-xs text-on-surface-variant">
              Strict Truth Engine Verification
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-on-surface mt-1">
            Targeted Resume Generator
          </h1>
          <p className="text-sm text-on-surface-variant">
            Tailor your resume for a specific position by prioritizing genuine verified experience without changing underlying facts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/resume-studio"
            className="rounded-lg bg-on-surface px-4 py-2 text-xs font-semibold text-surface transition"
          >
            Resume Studio
          </Link>
          <Link
            href="/resume-analyzer"
            className="px-4 py-2 text-xs font-medium border border-outline hover:bg-surface-subtle rounded-lg transition"
          >
            ATS Diagnostics
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-danger bg-danger-container border border-danger/30 rounded-lg">
          {error}
        </div>
      )}

      {/* Input Form Card */}
      <div className="p-6 rounded-2xl border border-outline-variant bg-surface space-y-5">
        <h2 className="text-base font-bold text-on-surface">
          Job Target Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Target Role / Job Title
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Kubernetes Platform Architect"
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline bg-transparent text-on-surface"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Company Name (Optional)
            </label>
            <input
              type="text"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="e.g. Stripe, Acme Corp"
              className="w-full px-3 py-2 text-sm rounded-lg border border-outline bg-transparent text-on-surface"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">
            Job Description Requirements
          </label>
          <textarea
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste complete job description requirements here..."
            className="w-full p-3 text-xs rounded-xl border border-outline bg-transparent text-on-surface font-mono"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {generating ? 'Generating Grounded Resume...' : 'Generate Grounded Targeted Resume'}
          </button>
        </div>
      </div>

      {/* Results View: Diff Comparison & Gaps */}
      {result && (
        <div className="space-y-6">
          {/* Grounding Attestation Banner */}
          <div className="p-4 rounded-xl bg-success-container border border-success/30 text-success text-xs leading-relaxed flex items-start gap-3">
            <span className="text-base font-bold text-success">✓</span>
            <div>
              <strong className="font-semibold block mb-0.5">Truth Engine Grounding Attestation:</strong>
              {result.groundingAttestation}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-outline-variant bg-surface text-center">
              <span className="text-xs text-on-surface-variant font-medium">Alignment Match</span>
              <div className="text-2xl font-bold text-success">
                {result.alignmentScore}%
              </div>
            </div>
            <div className="p-4 rounded-xl border border-outline-variant bg-surface text-center">
              <span className="text-xs text-on-surface-variant font-medium">Matched Keywords</span>
              <div className="text-2xl font-bold text-on-surface">
                {result.matchedKeywords.length}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-outline-variant bg-surface text-center">
              <span className="text-xs text-on-surface-variant font-medium">Missing Requirements</span>
              <div className="text-2xl font-bold text-warning">
                {result.missingRequirements.length}
              </div>
            </div>
          </div>

          {/* Missing Requirements Banner (Never Fabricated) */}
          {result.missingRequirements.length > 0 && (
            <div className="p-4 rounded-xl bg-warning-container border border-warning/30 space-y-2">
              <div className="text-xs font-bold text-warning flex items-center gap-1.5">
                <span>⚠</span>
                <span>Unmatched Job Requirements (Never Fabricated)</span>
              </div>
              <p className="text-xs text-warning">
                The job description mentions the following technologies that are absent from your verified records. The AI has refused to invent them:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.missingRequirements.map((req, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs font-mono bg-surface text-warning border border-warning/30 rounded"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Before/After Diff Viewer */}
          <div className="p-6 rounded-2xl border border-outline-variant bg-surface space-y-6">
            <h3 className="text-base font-bold text-on-surface border-b border-outline-variant pb-3">
              Side-by-Side Tailoring Diff (Before vs. After)
            </h3>

            {/* Summary Diff */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Professional Summary Optimization
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-outline-variant bg-surface-subtle text-xs text-on-surface-variant">
                  <div className="font-semibold text-on-surface-variant mb-1">Original Summary:</div>
                  {result.diff.summary.original || '(No summary provided in base resume)'}
                </div>
                <div className="p-3 rounded-lg border border-primary/30 bg-primary-container/40 text-xs text-primary">
                  <div className="font-semibold text-primary mb-1">Tailored Summary:</div>
                  {result.diff.summary.targeted}
                </div>
              </div>
            </div>

            {/* Skills Diff */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Skills Re-prioritization
              </span>
              <p className="text-xs text-on-surface-variant">
                Verified skills matching the job description are prioritized to appear first on the document.
              </p>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-outline-variant bg-surface-subtle">
                {result.diff.skills.targeted.map((skill, i) => {
                  const isMatched = result.matchedKeywords.includes(skill.toLowerCase());
                  return (
                    <span
                      key={i}
                      className={`px-2.5 py-1 text-xs rounded-full font-medium ${ isMatched ? 'bg-primary-container text-primary border border-primary/30 ' : 'bg-surface-variant text-on-surface-variant ' }`}
                    >
                      {skill} {isMatched && '★'}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Human Approval Action */}
            <div className="pt-4 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-on-surface-variant">
                Draft created with status <span className="font-mono font-semibold">draft</span>. Review and approve before applying.
              </p>
              <button
                onClick={() => router.push('/resume-studio')}
                className="px-6 py-2.5 text-xs font-bold bg-success hover:bg-success/90 text-white rounded-lg transition"
              >
                Approve & Edit in Resume Studio →
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

