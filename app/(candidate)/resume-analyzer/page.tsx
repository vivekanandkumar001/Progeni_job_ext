'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getMasterResume,
  diagnoseResumeATS,
  compareResumeWithJD,
  type ResumeStudioData,
  type ATSDiagnosticResult,
  type JDComparisonResult,
} from '../../../lib/api';

export default function ResumeAnalyzerPage() {
  const [masterResume, setMasterResume] = useState<ResumeStudioData | null>(null);
  const [diagnosis, setDiagnosis] = useState<ATSDiagnosticResult | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [comparison, setComparison] = useState<JDComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzingJD, setAnalyzingJD] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const resume = await getMasterResume();
        setMasterResume(resume);

        const diag = await diagnoseResumeATS(undefined, resume.id);
        setDiagnosis(diag);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not analyze resume.');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  async function handleCompareJD() {
    if (!masterResume || !jobDescription.trim()) return;
    setAnalyzingJD(true);
    setError('');
    try {
      const skills = (masterResume.content.skills || []).map((s) => s.name);
      const res = await compareResumeWithJD({
        resumeId: masterResume.id,
        candidateSkills: skills,
        jobDescription,
      });
      setComparison(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Job description comparison failed.');
    } finally {
      setAnalyzingJD(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-64" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-96" />
          <div className="h-80 bg-slate-100 dark:bg-slate-900 rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Heuristic Diagnostic Engine
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Analyzing: {masterResume?.title} (v{masterResume?.version})
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            ATS Compatibility Diagnostics
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Algorithmic benchmark analysis covering contact completeness, standard section hierarchy, action verbs, and quantifiable metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/resume-studio"
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
          >
            Open in Studio
          </Link>
          <Link
            href="/targeted-resume"
            className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
          >
            Targeted Generator
          </Link>
        </div>
      </div>

      {/* Prominent Mandatory ATS Disclaimer */}
      {diagnosis?.disclaimer && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-3">
          <span className="text-base font-bold text-amber-600">ⓘ</span>
          <div>
            <strong className="font-semibold block mb-0.5">ATS Diagnostic Transparency Notice:</strong>
            {diagnosis.disclaimer}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-rose-800 bg-rose-50 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg">
          {error}
        </div>
      )}

      {/* Section 1: Overall Heuristic Score Gauge & Breakdown */}
      {diagnosis && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
          {/* Gauge Widget */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
            <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-8 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-center">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                  {diagnosis.overallScore}
                </span>
                <span className="text-xs text-slate-700 dark:text-slate-300 block font-medium">/ 100</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {diagnosis.rating}
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                Total Words: {diagnosis.readability.totalWords} • Bullets: {diagnosis.readability.bulletCount}
              </p>
            </div>
          </div>

          {/* Category Bars */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Evaluated Category Breakdown
            </h3>
            {Object.entries(diagnosis.categories).map(([key, cat]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{cat.name}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {cat.earnedScore} / {cat.maxScore} pts
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(cat.earnedScore / cat.maxScore) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-300">
                  {cat.feedback[0]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Metrics Found & Power Verbs Tags */}
      {diagnosis && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Quantifiable Metrics Detected ({diagnosis.metricsFound.length})</span>
              <span className="text-xs font-normal text-slate-700 dark:text-slate-300">Percentages, scale & impact</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.metricsFound.length ? (
                diagnosis.metricsFound.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded"
                  >
                    {m}
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  No measurable metrics detected. Express results with numbers (e.g., &quot;reduced latency by 40%&quot;).
                </p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Action Verbs Found ({diagnosis.actionVerbsFound.length})</span>
              <span className="text-xs font-normal text-slate-700 dark:text-slate-300">Leadership & execution phrasing</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.actionVerbsFound.length ? (
                diagnosis.actionVerbsFound.map((v, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded capitalize"
                  >
                    {v}
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Replace passive phrasing (e.g. &quot;Assisted with&quot;) with strong verbs like &quot;Architected&quot; or &quot;Delivered&quot;.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Interactive Job Description Keyword Gap Comparator */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Job Description Keyword Gap Analyzer
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            Paste a target Job Description to compare required technical keywords against your verified master resume profile.
          </p>
        </div>

        <textarea
          rows={5}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste full job description requirements here (e.g. We are hiring a Senior Kubernetes Engineer proficient in AWS, Docker, and Terraform...)"
          className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white font-mono"
        />

        <div className="flex justify-end">
          <button
            onClick={handleCompareJD}
            disabled={analyzingJD || !jobDescription.trim()}
            className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {analyzingJD ? 'Analyzing Keyword Gaps...' : 'Run Keyword Gap Analysis'}
          </button>
        </div>

        {/* Comparison Results Card */}
        {comparison && (
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold uppercase">Keyword Match Alignment</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {comparison.matchPercentage}%
                </div>
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Matched {comparison.matchedCount} of {comparison.totalRequiredKeywords} required keywords
              </span>
            </div>

            {/* Matched Keywords */}
            <div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                ✓ Matched in Your Resume ({comparison.matchedKeywords.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comparison.matchedKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords / Skill Gaps */}
            {comparison.missingKeywords.length > 0 && (
              <div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block mb-1">
                  ⚠ Unmatched Requirements in JD ({comparison.missingKeywords.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.missingKeywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {comparison.recommendations.length > 0 && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
                  Tailoring Recommendations:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {comparison.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

