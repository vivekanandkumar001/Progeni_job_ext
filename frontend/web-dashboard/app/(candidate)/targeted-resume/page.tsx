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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Zero-Hallucination Tailoring
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Strict Truth Engine Verification
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Targeted Resume Generator
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Tailor your resume for a specific position by prioritizing genuine verified experience without changing underlying facts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/resume-studio"
            className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg transition"
          >
            Resume Studio
          </Link>
          <Link
            href="/resume-analyzer"
            className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
          >
            ATS Diagnostics
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-rose-800 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Input Form Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Job Target Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Role / Job Title
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Kubernetes Platform Architect"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Company Name (Optional)
            </label>
            <input
              type="text"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="e.g. Stripe, Acme Corp"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Job Description Requirements
          </label>
          <textarea
            rows={6}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste complete job description requirements here..."
            className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white font-mono"
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
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed flex items-start gap-3">
            <span className="text-base font-bold text-emerald-600">✓</span>
            <div>
              <strong className="font-semibold block mb-0.5">Truth Engine Grounding Attestation:</strong>
              {result.groundingAttestation}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Alignment Match</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {result.alignmentScore}%
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Matched Keywords</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {result.matchedKeywords.length}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Missing Requirements</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {result.missingRequirements.length}
              </div>
            </div>
          </div>

          {/* Missing Requirements Banner (Never Fabricated) */}
          {result.missingRequirements.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span>⚠</span>
                <span>Unmatched Job Requirements (Never Fabricated)</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                The job description mentions the following technologies that are absent from your verified records. The AI has refused to invent them:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.missingRequirements.map((req, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded"
                  >
                    {req}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Before/After Diff Viewer */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
              Side-by-Side Tailoring Diff (Before vs. After)
            </h3>

            {/* Summary Diff */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Professional Summary Optimization
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Original Summary:</div>
                  {result.diff.summary.original || '(No summary provided in base resume)'}
                </div>
                <div className="p-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 text-xs text-purple-900 dark:text-purple-200">
                  <div className="font-semibold text-purple-700 dark:text-purple-300 mb-1">Tailored Summary:</div>
                  {result.diff.summary.targeted}
                </div>
              </div>
            </div>

            {/* Skills Diff */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Skills Re-prioritization
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Verified skills matching the job description are prioritized to appear first on the document.
              </p>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {result.diff.skills.targeted.map((skill, i) => {
                  const isMatched = result.matchedKeywords.includes(skill.toLowerCase());
                  return (
                    <span
                      key={i}
                      className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                        isMatched
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {skill} {isMatched && '★'}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Human Approval Action */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Draft created with status <span className="font-mono font-semibold">draft</span>. Review and approve before applying.
              </p>
              <button
                onClick={() => router.push('/resume-studio')}
                className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
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

