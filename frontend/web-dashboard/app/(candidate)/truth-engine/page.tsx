'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listTruthClaims,
  confirmTruthClaim,
  createTruthClaim,
  deleteTruthClaim,
  type ResumeClaim,
} from '../../../lib/api';

export default function TruthEnginePage() {
  const [claims, setClaims] = useState<ResumeClaim[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newClaimText, setNewClaimText] = useState('');
  const [newClaimCategory, setNewClaimCategory] = useState<ResumeClaim['category']>('skill');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadClaims() {
    try {
      setLoading(true);
      const data = await listTruthClaims();
      setClaims(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load truth claims.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadClaims();
  }, []);

  async function handleConfirm(claimId: string, confirmed: boolean) {
    setSaving(true);
    setError('');
    try {
      const updated = await confirmTruthClaim(claimId, confirmed);
      setClaims((prev) => prev.map((c) => (c.id === claimId ? updated : c)));
      setNotice(confirmed ? 'Claim confirmed by candidate.' : 'Claim disputed and marked unsupported.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation action failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClaim() {
    if (!newClaimText.trim()) return;
    setSaving(true);
    setError('');
    try {
      const created = await createTruthClaim({
        claim_text: newClaimText.trim(),
        category: newClaimCategory,
        candidate_confirmed: true,
      });
      setClaims((prev) => [created, ...prev]);
      setNewClaimText('');
      setNotice('New career claim registered.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register claim.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(claimId: string) {
    if (!confirm('Are you sure you want to delete this claim record?')) return;
    setSaving(true);
    try {
      await deleteTruthClaim(claimId);
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      setNotice('Claim record deleted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete claim.');
    } finally {
      setSaving(false);
    }
  }

  const filteredClaims = claims.filter((c) => {
    if (filterCategory !== 'all' && c.category !== filterCategory) return false;
    if (filterStatus !== 'all' && c.verification_status !== filterStatus) return false;
    return true;
  });

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Provenance & Evidence Layer
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Total Claims: {claims.length}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Truth Engine & Evidence Mapping
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Cryptographic-style claim verification ensuring every skill, role, metric, and credential is backed by verifiable document provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/resume-studio"
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
          >
            Resume Studio
          </Link>
          <Link
            href="/targeted-resume"
            className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition"
          >
            Targeted Generator
          </Link>
        </div>
      </div>

      {/* Strict Anti-Fabrication Notice */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs leading-relaxed flex items-start gap-3">
        <span className="text-base font-bold text-emerald-600">🛡</span>
        <div>
          <strong className="font-semibold block mb-0.5">Strict Anti-Fabrication Policy:</strong>
          The Truth Engine blocks the automatic or speculative upgrade of unsupported career claims.
          Targeted resume generation will strictly omit claims with status &quot;unsupported&quot; to guarantee 100% truthful job applications.
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

      {/* Add New Claim Form Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Register New Verified Claim
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newClaimText}
            onChange={(e) => setNewClaimText(e.target.value)}
            placeholder="e.g. AWS Certified Solutions Architect, Kubernetes, 6+ years experience"
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-white"
          />
          <select
            value={newClaimCategory}
            onChange={(e) => setNewClaimCategory(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
          >
            <option value="skill">Skill</option>
            <option value="experience_years">Years of Experience</option>
            <option value="employment_history">Employment History</option>
            <option value="education">Education</option>
            <option value="certification">Certification</option>
            <option value="project">Project Ownership</option>
            <option value="measurable_achievement">Measurable Metric</option>
          </select>
          <button
            onClick={handleCreateClaim}
            disabled={saving || !newClaimText.trim()}
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
          >
            Add Claim
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">All Categories</option>
            <option value="skill">Skills</option>
            <option value="experience_years">Experience Years</option>
            <option value="employment_history">Employment</option>
            <option value="education">Education</option>
            <option value="certification">Certifications</option>
            <option value="project">Projects</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="verified_from_source">Verified from Source</option>
            <option value="candidate_confirmed">Candidate Confirmed</option>
            <option value="unverified">Unverified</option>
            <option value="unsupported">Unsupported</option>
          </select>
        </div>
      </div>

      {/* Claims List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-700 dark:text-slate-300">Loading claims...</div>
      ) : filteredClaims.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
          No career claims matching the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClaims.map((claim) => {
            const isVerified = claim.verification_status === 'verified_from_source';
            const isConfirmed = claim.verification_status === 'candidate_confirmed';
            const isUnsupported = claim.verification_status === 'unsupported';

            return (
              <div
                key={claim.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {claim.claim_text}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded">
                      {claim.category.replace('_', ' ')}
                    </span>
                    {isVerified && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
                        ✓ Verified From Source
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded-full">
                        Candidate Confirmed
                      </span>
                    )}
                    {isUnsupported && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full">
                        Unsupported / Excluded
                      </span>
                    )}
                  </div>

                  {claim.supporting_source && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800">
                      <strong>Source:</strong> {claim.supporting_source.ref}
                      {claim.supporting_source.snippet && (
                        <span className="block text-slate-700 dark:text-slate-300 mt-0.5">
                          &quot;{claim.supporting_source.snippet}&quot;
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-3">
                    <span>Confidence: {Math.round(claim.confidence_score * 100)}%</span>
                    <span>Created: {new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {!isConfirmed && !isVerified && (
                    <button
                      onClick={() => handleConfirm(claim.id, true)}
                      disabled={saving}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-600 border border-emerald-300 dark:border-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition"
                    >
                      Confirm
                    </button>
                  )}
                  {!isUnsupported && (
                    <button
                      onClick={() => handleConfirm(claim.id, false)}
                      disabled={saving}
                      className="px-2.5 py-1 text-xs font-medium text-amber-600 border border-amber-300 dark:border-amber-800 rounded hover:bg-amber-50 dark:hover:bg-amber-950 transition"
                    >
                      Dispute
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(claim.id)}
                    disabled={saving}
                    className="px-2 py-1 text-xs text-rose-600 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

