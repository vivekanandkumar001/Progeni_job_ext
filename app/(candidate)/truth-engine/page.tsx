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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-container text-success">
              Provenance & Evidence Layer
            </span>
            <span className="text-xs text-on-surface-variant">
              Total Claims: {claims.length}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mt-1">
            Truth Engine & Evidence Mapping
          </h1>
          <p className="text-sm text-on-surface-variant">
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
            className="px-4 py-2 text-xs font-medium border border-outline hover:bg-surface-subtle rounded-lg transition"
          >
            Targeted Generator
          </Link>
        </div>
      </div>

      {/* Strict Anti-Fabrication Notice */}
      <div className="p-4 rounded-xl bg-surface-variant border border-outline-variant text-on-surface text-xs leading-relaxed flex items-start gap-3">
        <span className="text-base font-bold text-success">🛡</span>
        <div>
          <strong className="font-semibold block mb-0.5">Strict Anti-Fabrication Policy:</strong>
          The Truth Engine blocks the automatic or speculative upgrade of unsupported career claims.
          Targeted resume generation will strictly omit claims with status &quot;unsupported&quot; to guarantee 100% truthful job applications.
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-3 text-sm text-danger bg-danger-container border border-danger/30 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 text-sm text-success bg-success-container border border-success/30 rounded-lg">
          {notice}
        </div>
      )}

      {/* Add New Claim Form Card */}
      <div className="p-5 rounded-xl border border-outline-variant bg-surface space-y-3">
        <h3 className="text-sm font-bold text-on-surface">
          Register New Verified Claim
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newClaimText}
            onChange={(e) => setNewClaimText(e.target.value)}
            placeholder="e.g. AWS Certified Solutions Architect, Kubernetes, 6+ years experience"
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-outline bg-transparent text-on-surface"
          />
          <select
            value={newClaimCategory}
            onChange={(e) => setNewClaimCategory(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-outline bg-surface text-on-surface"
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg border border-outline-variant bg-surface-subtle">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-outline bg-surface"
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
          <label className="text-xs font-semibold text-on-surface-variant">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1 text-xs rounded border border-outline bg-surface"
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
        <div className="p-8 text-center text-xs text-on-surface-variant">Loading claims...</div>
      ) : filteredClaims.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline text-xs text-on-surface-variant">
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
                className="p-4 rounded-xl border border-outline-variant bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-on-surface">
                      {claim.claim_text}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-surface-variant text-on-surface-variant rounded">
                      {claim.category.replace('_', ' ')}
                    </span>
                    {isVerified && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-success-container text-success rounded-full">
                        ✓ Verified From Source
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-info-container text-info rounded-full">
                        Candidate Confirmed
                      </span>
                    )}
                    {isUnsupported && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-danger-container text-danger rounded-full">
                        Unsupported / Excluded
                      </span>
                    )}
                  </div>

                  {claim.supporting_source && (
                    <div className="text-[11px] text-on-surface-variant font-mono bg-surface-subtle px-2.5 py-1 rounded border border-outline-variant">
                      <strong>Source:</strong> {claim.supporting_source.ref}
                      {claim.supporting_source.snippet && (
                        <span className="block text-on-surface-variant mt-0.5">
                          &quot;{claim.supporting_source.snippet}&quot;
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-on-surface-variant flex items-center gap-3">
                    <span>Confidence: {Math.round(claim.confidence_score * 100)}%</span>
                    <span>Created: {new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {!isConfirmed && !isVerified && (
                    <button
                      onClick={() => handleConfirm(claim.id, true)}
                      disabled={saving}
                      className="px-2.5 py-1 text-xs font-medium text-success border border-success/30 rounded hover:bg-success-container transition"
                    >
                      Confirm
                    </button>
                  )}
                  {!isUnsupported && (
                    <button
                      onClick={() => handleConfirm(claim.id, false)}
                      disabled={saving}
                      className="px-2.5 py-1 text-xs font-medium text-warning border border-warning/30 rounded hover:bg-warning-container transition"
                    >
                      Dispute
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(claim.id)}
                    disabled={saving}
                    className="px-2 py-1 text-xs text-danger hover:text-danger"
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

