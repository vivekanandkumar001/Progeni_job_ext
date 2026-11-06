import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';

const CLAIMS_TABLE = 'resume_claims';

export type ClaimCategory =
  | 'skill'
  | 'experience_years'
  | 'employment_history'
  | 'education'
  | 'certification'
  | 'project'
  | 'measurable_achievement';

export type ClaimVerificationStatus =
  | 'verified_from_source'
  | 'candidate_confirmed'
  | 'unverified'
  | 'unsupported';

export interface EvidenceSource {
  type: 'uploaded_document' | 'github_repo' | 'credential_url' | 'profile_entry' | 'manual_claim';
  ref: string;
  snippet?: string | null;
}

export interface ResumeClaim {
  id: string;
  user_id: string;
  resume_id?: string | null;
  category: ClaimCategory;
  claim_text: string;
  supporting_source?: EvidenceSource | null;
  verification_status: ClaimVerificationStatus;
  candidate_confirmed: boolean;
  confirmed_at?: string | null;
  confidence_score: number; // 0.0 - 1.0
  audit_notes?: string | null;
  created_at: string;
  updated_at: string;
}

type ClaimDocument = Omit<ResumeClaim, 'id'> & { _id: string };

export class TruthEngineService {
  async getClaims(
    userId: string,
    filter?: { resume_id?: string; category?: ClaimCategory; status?: ClaimVerificationStatus },
  ): Promise<ResumeClaim[]> {
    const query: Record<string, any> = { user_id: userId };
    if (filter?.resume_id) query.resume_id = filter.resume_id;
    if (filter?.category) query.category = filter.category;
    if (filter?.status) query.verification_status = filter.status;

    const docs = await (await getDatabase())
      .collection<ClaimDocument>(CLAIMS_TABLE)
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    return docs.map((doc) => this.toRow(doc));
  }

  async getClaim(userId: string, claimId: string): Promise<ResumeClaim | null> {
    const doc = await (await getDatabase())
      .collection<ClaimDocument>(CLAIMS_TABLE)
      .findOne({ _id: claimId as any, user_id: userId });
    return doc ? this.toRow(doc) : null;
  }

  async createClaim(
    userId: string,
    payload: {
      resume_id?: string | null;
      category: ClaimCategory;
      claim_text: string;
      supporting_source?: EvidenceSource | null;
      candidate_confirmed?: boolean;
      audit_notes?: string | null;
    },
  ): Promise<ResumeClaim> {
    const trimmedText = payload.claim_text.trim();
    if (!trimmedText) {
      throw new Error('Claim text cannot be empty.');
    }

    // Determine initial status based on supporting source evidence
    let verification_status: ClaimVerificationStatus = 'unverified';
    let confidence_score = 0.5;

    if (payload.supporting_source && payload.supporting_source.snippet) {
      // Source evidence provided with text snippet
      verification_status = 'verified_from_source';
      confidence_score = 0.95;
    } else if (payload.candidate_confirmed) {
      verification_status = 'candidate_confirmed';
      confidence_score = 0.8;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const doc: ClaimDocument = {
      _id: id,
      user_id: userId,
      resume_id: payload.resume_id || null,
      category: payload.category,
      claim_text: trimmedText,
      supporting_source: payload.supporting_source || null,
      verification_status,
      candidate_confirmed: Boolean(payload.candidate_confirmed),
      confirmed_at: payload.candidate_confirmed ? now : null,
      confidence_score,
      audit_notes: payload.audit_notes || null,
      created_at: now,
      updated_at: now,
    };

    await (await getDatabase()).collection<ClaimDocument>(CLAIMS_TABLE).insertOne(doc as any);
    return this.toRow(doc);
  }

  async confirmClaim(
    userId: string,
    claimId: string,
    confirmed: boolean,
    candidateNotes?: string,
  ): Promise<ResumeClaim> {
    const collection = (await getDatabase()).collection<ClaimDocument>(CLAIMS_TABLE);
    const existing = await collection.findOne({ _id: claimId as any, user_id: userId });
    if (!existing) {
      throw new Error('Claim not found or unauthorized.');
    }

    const now = new Date().toISOString();
    let updatedStatus: ClaimVerificationStatus;
    let confidence = existing.confidence_score;

    if (confirmed) {
      // If already verified from source, preserve it; otherwise upgrade to candidate_confirmed
      updatedStatus =
        existing.verification_status === 'verified_from_source'
          ? 'verified_from_source'
          : 'candidate_confirmed';
      confidence = Math.max(confidence, 0.85);
    } else {
      // Candidate disputed or rejected the claim -> unsupported
      updatedStatus = 'unsupported';
      confidence = 0.0;
    }

    await collection.updateOne(
      { _id: claimId as any, user_id: userId },
      {
        $set: {
          candidate_confirmed: confirmed,
          confirmed_at: confirmed ? now : null,
          verification_status: updatedStatus,
          confidence_score: confidence,
          audit_notes: candidateNotes || existing.audit_notes,
          updated_at: now,
        },
      },
    );

    const updated = await collection.findOne({ _id: claimId as any, user_id: userId });
    return this.toRow(updated!);
  }

  async addEvidence(
    userId: string,
    claimId: string,
    evidence: EvidenceSource,
  ): Promise<ResumeClaim> {
    const collection = (await getDatabase()).collection<ClaimDocument>(CLAIMS_TABLE);
    const existing = await collection.findOne({ _id: claimId as any, user_id: userId });
    if (!existing) {
      throw new Error('Claim not found or unauthorized.');
    }

    const now = new Date().toISOString();
    const hasSnippet = Boolean(evidence.snippet && evidence.snippet.trim().length > 0);
    const newStatus: ClaimVerificationStatus = hasSnippet
      ? 'verified_from_source'
      : existing.candidate_confirmed
      ? 'candidate_confirmed'
      : 'unverified';

    await collection.updateOne(
      { _id: claimId as any, user_id: userId },
      {
        $set: {
          supporting_source: evidence,
          verification_status: newStatus,
          confidence_score: hasSnippet ? 0.95 : 0.7,
          updated_at: now,
        },
      },
    );

    const updated = await collection.findOne({ _id: claimId as any, user_id: userId });
    return this.toRow(updated!);
  }

  async deleteClaim(userId: string, claimId: string): Promise<boolean> {
    const result = await (await getDatabase())
      .collection<ClaimDocument>(CLAIMS_TABLE)
      .deleteOne({ _id: claimId as any, user_id: userId });
    return result.deletedCount === 1;
  }

  /**
   * Extract claims automatically from raw parsed resume analysis.
   */
  async extractClaimsFromResumeAnalysis(
    userId: string,
    resumeId: string,
    analysis: {
      fileName: string;
      detected: {
        fullName?: string | null;
        experienceYears?: number | null;
        experienceEvidence?: string | null;
      };
      skills: Array<{ skill: string; evidence: string }>;
    },
  ): Promise<ResumeClaim[]> {
    const created: ResumeClaim[] = [];

    // Extract skills with line evidence
    for (const item of analysis.skills) {
      const claim = await this.createClaim(userId, {
        resume_id: resumeId,
        category: 'skill',
        claim_text: item.skill,
        supporting_source: {
          type: 'uploaded_document',
          ref: `${analysis.fileName}`,
          snippet: item.evidence,
        },
        candidate_confirmed: true,
      });
      created.push(claim);
    }

    // Extract experience years if verified
    if (analysis.detected.experienceYears !== null && analysis.detected.experienceYears !== undefined) {
      const claim = await this.createClaim(userId, {
        resume_id: resumeId,
        category: 'experience_years',
        claim_text: `${analysis.detected.experienceYears} years of professional experience`,
        supporting_source: {
          type: 'uploaded_document',
          ref: `${analysis.fileName}`,
          snippet: analysis.detected.experienceEvidence || null,
        },
        candidate_confirmed: true,
      });
      created.push(claim);
    }

    return created;
  }

  /**
   * Returns all verified or candidate-confirmed facts for a user.
   * Strictly filters out unverified or unsupported claims to prevent fabrication.
   */
  async getVerifiedCandidateFacts(userId: string): Promise<{
    verifiedSkills: Set<string>;
    experienceYears: number | null;
    claims: ResumeClaim[];
  }> {
    const allClaims = await this.getClaims(userId);
    const validClaims = allClaims.filter(
      (c) =>
        c.verification_status === 'verified_from_source' ||
        c.verification_status === 'candidate_confirmed',
    );

    const verifiedSkills = new Set<string>();
    let experienceYears: number | null = null;

    for (const c of validClaims) {
      if (c.category === 'skill') {
        verifiedSkills.add(c.claim_text.toLowerCase().trim());
      } else if (c.category === 'experience_years') {
        const match = c.claim_text.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          experienceYears = Number(match[1]);
        }
      }
    }

    return {
      verifiedSkills,
      experienceYears,
      claims: validClaims,
    };
  }

  private toRow(doc: ClaimDocument): ResumeClaim {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  }
}

export const truthEngineService = new TruthEngineService();

