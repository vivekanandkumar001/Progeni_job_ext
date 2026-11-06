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
          <div className="h-8 bg-surface-variant rounded w-64" />
          <div className="h-4 bg-surface-variant rounded w-96" />
          <div className="h-80 bg-surface-variant rounded-xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info-container text-info">
              Heuristic Diagnostic Engine
            </span>
            <span className="text-xs text-on-surface-variant">
              Analyzing: {masterResume?.title} (v{masterResume?.version})
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-on-surface mt-1">
            ATS Compatibility Diagnostics
          </h1>
          <p className="text-sm text-on-surface-variant">
            Algorithmic benchmark analysis covering contact completeness, standard section hierarchy, action verbs, and quantifiable metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/resume-studio"
            className="px-4 py-2 text-xs font-semibold bg-success hover:bg-success/90 text-white rounded-lg transition"
          >
            Open in Studio
          </Link>
          <Link
            href="/targeted-resume"
            className="px-4 py-2 text-xs font-medium border border-outline hover:bg-surface-subtle rounded-lg transition"
          >
            Targeted Generator
          </Link>
        </div>
      </div>

      {/* Prominent Mandatory ATS Disclaimer */}
      {diagnosis?.disclaimer && (
        <div className="p-4 rounded-xl bg-warning-container border border-warning/30 text-warning text-xs leading-relaxed flex items-start gap-3">
          <span className="text-base font-bold text-warning">ⓘ</span>
          <div>
            <strong className="font-semibold block mb-0.5">ATS Diagnostic Transparency Notice:</strong>
            {diagnosis.disclaimer}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-danger bg-danger-container border border-danger/30 rounded-lg">
          {error}
        </div>
      )}

      {/* Section 1: Overall Heuristic Score Gauge & Breakdown */}
      {diagnosis && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-surface border border-outline-variant p-6 rounded-2xl">
          {/* Gauge Widget */}
          <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-outline-variant">
            <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-8 border-success/30 bg-success-container">
              <div className="text-center">
                <span className="text-4xl font-semibold text-on-surface">
                  {diagnosis.overallScore}
                </span>
                <span className="text-xs text-on-surface-variant block font-medium">/ 100</span>
              </div>
            </div>
            <div className="mt-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-success-container text-success">
                {diagnosis.rating}
              </span>
              <p className="text-xs text-on-surface-variant mt-2">
                Total Words: {diagnosis.readability.totalWords} • Bullets: {diagnosis.readability.bulletCount}
              </p>
            </div>
          </div>

          {/* Category Bars */}
          <div className="md:col-span-8 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
              Evaluated Category Breakdown
            </h3>
            {Object.entries(diagnosis.categories).map(([key, cat]) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>{cat.name}</span>
                  <span className="text-success">
                    {cat.earnedScore} / {cat.maxScore} pts
                  </span>
                </div>
                <div className="w-full bg-surface-variant rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(cat.earnedScore / cat.maxScore) * 100}%` }}
                  />
                </div>
                <p className="text-[11px] text-on-surface-variant">
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
          <div className="p-5 rounded-xl border border-outline-variant bg-surface space-y-3">
            <h3 className="text-sm font-bold text-on-surface flex items-center justify-between">
              <span>Quantifiable Metrics Detected ({diagnosis.metricsFound.length})</span>
              <span className="text-xs font-normal text-on-surface-variant">Percentages, scale & impact</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.metricsFound.length ? (
                diagnosis.metricsFound.map((m, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-success-container text-success border border-success/30 rounded"
                  >
                    {m}
                  </span>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant">
                  No measurable metrics detected. Express results with numbers (e.g., &quot;reduced latency by 40%&quot;).
                </p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-outline-variant bg-surface space-y-3">
            <h3 className="text-sm font-bold text-on-surface flex items-center justify-between">
              <span>Action Verbs Found ({diagnosis.actionVerbsFound.length})</span>
              <span className="text-xs font-normal text-on-surface-variant">Leadership & execution phrasing</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.actionVerbsFound.length ? (
                diagnosis.actionVerbsFound.map((v, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-info-container text-info border border-info/30 rounded capitalize"
                  >
                    {v}
                  </span>
                ))
              ) : (
                <p className="text-xs text-on-surface-variant">
                  Replace passive phrasing (e.g. &quot;Assisted with&quot;) with strong verbs like &quot;Architected&quot; or &quot;Delivered&quot;.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Interactive Job Description Keyword Gap Comparator */}
      <div className="p-6 rounded-2xl border border-outline-variant bg-surface space-y-5">
        <div>
          <h2 className="text-lg font-bold text-on-surface">
            Job Description Keyword Gap Analyzer
          </h2>
          <p className="text-xs text-on-surface-variant">
            Paste a target Job Description to compare required technical keywords against your verified master resume profile.
          </p>
        </div>

        <textarea
          rows={5}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste full job description requirements here (e.g. We are hiring a Senior Kubernetes Engineer proficient in AWS, Docker, and Terraform...)"
          className="w-full p-3 text-xs rounded-xl border border-outline bg-transparent text-on-surface font-mono"
        />

        <div className="flex justify-end">
          <button
            onClick={handleCompareJD}
            disabled={analyzingJD || !jobDescription.trim()}
            className="px-5 py-2 text-xs font-semibold bg-success hover:bg-success/90 text-white rounded-lg transition disabled:opacity-50"
          >
            {analyzingJD ? 'Analyzing Keyword Gaps...' : 'Run Keyword Gap Analysis'}
          </button>
        </div>

        {/* Comparison Results Card */}
        {comparison && (
          <div className="p-5 rounded-xl border border-outline-variant bg-surface-subtle space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <span className="text-xs text-on-surface-variant font-semibold uppercase">Keyword Match Alignment</span>
                <div className="text-2xl font-bold text-on-surface">
                  {comparison.matchPercentage}%
                </div>
              </div>
              <span className="text-xs font-medium text-on-surface-variant">
                Matched {comparison.matchedCount} of {comparison.totalRequiredKeywords} required keywords
              </span>
            </div>

            {/* Matched Keywords */}
            <div>
              <span className="text-xs font-bold text-success block mb-1">
                ✓ Matched in Your Resume ({comparison.matchedKeywords.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {comparison.matchedKeywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs font-mono bg-success-container text-success border border-success/30 rounded"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Keywords / Skill Gaps */}
            {comparison.missingKeywords.length > 0 && (
              <div>
                <span className="text-xs font-bold text-warning block mb-1">
                  ⚠ Unmatched Requirements in JD ({comparison.missingKeywords.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.missingKeywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs font-mono bg-warning-container text-warning border border-warning/30 rounded"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {comparison.recommendations.length > 0 && (
              <div className="border-t border-outline-variant pt-3">
                <span className="text-xs font-bold text-on-surface block mb-1">
                  Tailoring Recommendations:
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-on-surface-variant">
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

