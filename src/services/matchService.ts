import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';
import { candidatePreferencesService } from './candidatePreferencesService.js';
import { candidateProfileService } from './candidateProfileService.js';
import { matchingEngine } from './matching/matchingEngine.js';
import { skillGapAnalyzer, type SkillGapAnalysisResult } from './matching/skillGapAnalyzer.js';
import type {
  CandidateMatchingProfile,
  JobMatchingPosting,
} from './matching/matchingEngine.js';
import type {
  DeterministicMatchResult,
  EligibilityDecision,
  MatchDocument,
} from './matching/types.js';
import { truthEngineService, type ResumeClaim } from './truthEngineService.js';

const TABLE = 'job_matches';
const JOBS_TABLE = 'jobs';

export interface CreateMatchInput {
  jobId?: string | null;
  score: number;
  factors: Record<string, unknown>;
  explanation: string[];
  missingEvidence: string[];
  eligible: boolean;
  blockers: string[];
  unknowns: string[];
  evidence: string[];
}

export interface MatchListOptions {
  sort?: 'relevance' | 'skills' | 'eligibility' | 'date' | 'newest_jobs';
  eligibility_status?: EligibilityDecision;
  min_score?: number;
  page?: number;
  limit?: number;
}

export interface MatchSummaryResult {
  total_matches: number;
  eligible_count: number;
  potentially_eligible_count: number;
  ineligible_count: number;
  average_score: number;
  top_matches: DeterministicMatchResult[];
}

export class MatchService {
  /**
   * Recalculates match scores for a candidate against active discovered jobs.
   */
  async recalculateMatches(
    userId: string,
    options?: { jobIds?: string[] },
  ): Promise<DeterministicMatchResult[]> {
    const db = await getDatabase();

    // 1. Fetch candidate profile and career preferences
    const [profile, preferences, claims] = await Promise.all([
      candidateProfileService.get(userId),
      candidatePreferencesService.get(userId),
      truthEngineService.getClaims(userId),
    ]);

    const verifiedSkills = claims
      .filter(
        (c: ResumeClaim) =>
          (c.verification_status === 'verified_from_source' ||
            c.verification_status === 'candidate_confirmed') &&
          c.category === 'skill',
      )
      .map((c: ResumeClaim) => c.claim_text);

    const candidateProfile: CandidateMatchingProfile = {
      id: userId,
      user_id: userId,
      target_role: profile?.target_role,
      skills: profile?.skills || [],
      experience_years: profile?.experience_years ?? null,
      education: profile?.education || [],
      city: profile?.city,
      country: profile?.country,
      location: profile?.location,
      desired_roles: preferences?.desired_roles || [],
      preferred_locations: preferences?.preferred_locations || [],
      workplace_type: preferences?.workplace_type,
      expected_salary_min: preferences?.expected_salary?.min,
      expected_salary_currency: preferences?.expected_salary?.currency,
      verified_skills: verifiedSkills,
    };

    // 2. Fetch active jobs (excluding expired or closed jobs)
    const jobQuery: any = {
      status: { $in: ['active', null, undefined] },
    };
    if (options?.jobIds && options.jobIds.length > 0) {
      jobQuery._id = { $in: options.jobIds };
    }

    const jobDocs = await db
      .collection<any>(JOBS_TABLE)
      .find(jobQuery)
      .sort({ posted_at: -1, created_at: -1 })
      .limit(100)
      .toArray();

    const results: DeterministicMatchResult[] = [];

    for (const jobDoc of jobDocs) {
      const job: JobMatchingPosting = {
        id: jobDoc._id,
        job_title: jobDoc.job_title || jobDoc.title || 'Untitled Role',
        company_name: jobDoc.company_name || jobDoc.company || 'Unknown Company',
        job_description: jobDoc.job_description,
        required_skills: jobDoc.required_skills || jobDoc.skills || [],
        preferred_skills: jobDoc.preferred_skills || [],
        mandatory_skills: jobDoc.mandatory_skills || jobDoc.required_skills,
        experience_min: jobDoc.experience_min,
        experience_max: jobDoc.experience_max,
        salary_min: jobDoc.salary_min,
        salary_max: jobDoc.salary_max,
        salary_currency: jobDoc.salary_currency,
        location: jobDoc.location,
        country: jobDoc.country,
        workplace_mode: jobDoc.workplace_mode,
        employment_type: jobDoc.employment_type,
        status: jobDoc.status || 'active',
      };

      const matchResult = matchingEngine.evaluateMatch(candidateProfile, job);

      // Idempotent upsert into job_matches collection
      const doc: MatchDocument = {
        ...matchResult,
        _id: matchResult.id,
      };

      await db.collection<any>(TABLE).updateOne(
        { user_id: userId, job_id: job.id },
        { $set: doc },
        { upsert: true },
      );

      results.push(matchResult);
    }

    // Sort by overall score descending
    results.sort((a, b) => b.overall_score - a.overall_score);
    return results;
  }

  async list(
    userId: string,
    options?: MatchListOptions,
  ): Promise<{ matches: (DeterministicMatchResult & { job?: any })[]; total: number }> {
    const db = await getDatabase();
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options?.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = { user_id: userId };
    if (options?.eligibility_status) {
      filter.eligibility_status = options.eligibility_status;
    }
    if (options?.min_score) {
      filter.overall_score = { $gte: Number(options.min_score) };
    }

    let sortObj: any = { overall_score: -1 };
    if (options?.sort === 'skills') {
      sortObj = { 'dimension_scores.skills_alignment': -1 };
    } else if (options?.sort === 'date' || options?.sort === 'newest_jobs') {
      sortObj = { created_at: -1 };
    } else if (options?.sort === 'eligibility') {
      sortObj = { eligibility_status: 1, overall_score: -1 };
    }

    const total = await db.collection<any>(TABLE).countDocuments(filter);
    const docs = await db
      .collection<any>(TABLE)
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Populate job details
    const jobIds = docs.map((d) => d.job_id).filter(Boolean);
    const jobDocs = await db
      .collection<any>(JOBS_TABLE)
      .find({ _id: { $in: jobIds } })
      .toArray();

    const jobMap = new Map<string, any>();
    for (const j of jobDocs) {
      jobMap.set(j._id, {
        id: j._id,
        job_title: j.job_title || j.title,
        company_name: j.company_name || j.company,
        location: j.location,
        workplace_mode: j.workplace_mode || 'office',
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        salary_currency: j.salary_currency,
        required_skills: j.required_skills || j.skills || [],
        application_url: j.application_url || j.url,
        canonical_url: j.canonical_url || j.url,
      });
    }

    const matches = docs.map((d) => ({
      ...this.toRow(d),
      job: d.job_id ? jobMap.get(d.job_id) || null : null,
    }));

    return { matches, total };
  }

  async get(id: string, userId: string): Promise<(DeterministicMatchResult & { job?: any }) | null> {
    const db = await getDatabase();
    // Security / IDOR: Ensure user_id matches
    const doc = await db.collection<any>(TABLE).findOne({ _id: id as any, user_id: userId });
    if (!doc) return null;

    let job: any = null;
    if (doc.job_id) {
      const jobDoc = await db.collection<any>(JOBS_TABLE).findOne({ _id: doc.job_id as any });
      if (jobDoc) {
        job = {
          id: jobDoc._id,
          job_title: jobDoc.job_title || jobDoc.title,
          company_name: jobDoc.company_name || jobDoc.company,
          job_description: jobDoc.job_description,
          location: jobDoc.location,
          workplace_mode: jobDoc.workplace_mode || 'office',
          salary_min: jobDoc.salary_min,
          salary_max: jobDoc.salary_max,
          salary_currency: jobDoc.salary_currency,
          required_skills: jobDoc.required_skills || jobDoc.skills || [],
          preferred_skills: jobDoc.preferred_skills || [],
          responsibilities: jobDoc.responsibilities || [],
          application_url: jobDoc.application_url || jobDoc.url,
          canonical_url: jobDoc.canonical_url || jobDoc.url,
        };
      }
    }

    return {
      ...this.toRow(doc),
      job,
    };
  }

  async getSummary(userId: string): Promise<MatchSummaryResult> {
    const db = await getDatabase();
    const docs = await db.collection<any>(TABLE).find({ user_id: userId }).toArray();

    if (docs.length === 0) {
      return {
        total_matches: 0,
        eligible_count: 0,
        potentially_eligible_count: 0,
        ineligible_count: 0,
        average_score: 0,
        top_matches: [],
      };
    }

    let totalScore = 0;
    let eligibleCount = 0;
    let potentiallyEligibleCount = 0;
    let ineligibleCount = 0;

    for (const d of docs) {
      totalScore += d.overall_score || d.score || 0;
      if (d.eligibility_status === 'eligible' || d.eligible === true) {
        eligibleCount++;
      } else if (d.eligibility_status === 'potentially_eligible') {
        potentiallyEligibleCount++;
      } else if (d.eligibility_status === 'ineligible') {
        ineligibleCount++;
      }
    }

    const sorted = [...docs].sort(
      (a, b) => (b.overall_score || b.score || 0) - (a.overall_score || a.score || 0),
    );

    return {
      total_matches: docs.length,
      eligible_count: eligibleCount,
      potentially_eligible_count: potentiallyEligibleCount,
      ineligible_count: ineligibleCount,
      average_score: Math.round(totalScore / docs.length),
      top_matches: sorted.slice(0, 3).map((d) => this.toRow(d)),
    };
  }

  async getSkillGaps(userId: string): Promise<SkillGapAnalysisResult> {
    const [profile, preferences, claims] = await Promise.all([
      candidateProfileService.get(userId),
      candidatePreferencesService.get(userId),
      truthEngineService.getClaims(userId),
    ]);

    const targetRoles = (preferences?.desired_roles || []).concat(
      profile?.target_role ? [profile.target_role] : [],
    );
    const candidateSkills = profile?.skills || [];
    const verifiedSkills = claims
      .filter(
        (c: ResumeClaim) =>
          (c.verification_status === 'verified_from_source' ||
            c.verification_status === 'candidate_confirmed') &&
          c.category === 'skill',
      )
      .map((c: ResumeClaim) => c.claim_text);

    return skillGapAnalyzer.analyzeGapsForCandidate(
      userId,
      candidateSkills,
      targetRoles,
      verifiedSkills,
    );
  }

  /**
   * Backward-compatible legacy manual match insertion
   */
  async create(userId: string, body: CreateMatchInput): Promise<any> {
    const id = randomUUID();
    const doc: any = {
      _id: id,
      id,
      user_id: userId,
      candidate_id: userId,
      job_id: body.jobId || null,
      overall_score: body.score,
      score: body.score,
      dimension_scores: {
        skills_alignment: (body.factors?.skills as number) ?? body.score,
        experience_eligibility: (body.factors?.experience as number) ?? body.score,
        role_relevance: (body.factors?.role as number) ?? body.score,
        education_eligibility: (body.factors?.education as number) ?? 100,
        location_compatibility: (body.factors?.location as number) ?? 100,
        salary_compatibility: (body.factors?.salary as number) ?? 100,
      },
      factors: body.factors || null,
      explanation: Array.isArray(body.explanation) ? body.explanation : null,
      missing_evidence: Array.isArray(body.missingEvidence) ? body.missingEvidence : null,
      eligible: typeof body.eligible === 'boolean' ? body.eligible : false,
      eligibility_status: body.eligible ? 'eligible' : 'ineligible',
      blockers: Array.isArray(body.blockers) ? body.blockers : null,
      unknowns: Array.isArray(body.unknowns) ? body.unknowns : null,
      evidence: Array.isArray(body.evidence) ? body.evidence : null,
      matched_skills: [],
      missing_required_skills: [],
      missing_preferred_skills: [],
      skill_details: [],
      experience_details: { candidate_years: null, job_min_years: null, job_max_years: null, status: 'unknown', note: '' },
      education_details: { candidate_degrees: [], required_degree: null, status: 'not_required', note: '' },
      location_details: { candidate_locations: [], candidate_mode: 'remote', job_location: null, job_mode: 'remote', status: 'remote_eligible', note: '' },
      salary_details: { candidate_min: null, candidate_currency: null, job_min: null, job_max: null, job_currency: null, status: 'salary_unlisted', note: '' },
      warnings: [],
      confidence: 100,
      algorithm_version: 'v5.0.0-legacy',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await (await getDatabase()).collection<any>(TABLE).insertOne(doc);
    return this.toRow(doc);
  }

  private toRow(doc: any): DeterministicMatchResult {
    const { _id, ...data } = doc;
    return {
      id: _id,
      user_id: data.user_id,
      candidate_id: data.candidate_id || data.user_id,
      job_id: data.job_id,
      overall_score: data.overall_score !== undefined ? data.overall_score : data.score || 0,
      dimension_scores: data.dimension_scores || {
        skills_alignment: data.factors?.skills || data.score || 0,
        experience_eligibility: data.factors?.experience || data.score || 0,
        role_relevance: data.factors?.role || data.score || 0,
        education_eligibility: data.factors?.education || 100,
        location_compatibility: data.factors?.location || 100,
        salary_compatibility: data.factors?.salary || 100,
      },
      eligibility_status: data.eligibility_status || (data.eligible ? 'eligible' : 'ineligible'),
      matched_skills: Array.isArray(data.matched_skills) ? data.matched_skills : [],
      missing_required_skills: Array.isArray(data.missing_required_skills) ? data.missing_required_skills : [],
      missing_preferred_skills: Array.isArray(data.missing_preferred_skills) ? data.missing_preferred_skills : [],
      skill_details: Array.isArray(data.skill_details) ? data.skill_details : [],
      experience_details: data.experience_details || { candidate_years: null, job_min_years: null, job_max_years: null, status: 'unknown', note: '' },
      education_details: data.education_details || { candidate_degrees: [], required_degree: null, status: 'not_required', note: '' },
      location_details: data.location_details || { candidate_locations: [], candidate_mode: 'remote', job_location: null, job_mode: 'remote', status: 'remote_eligible', note: '' },
      salary_details: data.salary_details || { candidate_min: null, candidate_currency: null, job_min: null, job_max: null, job_currency: null, status: 'salary_unlisted', note: '' },
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      unknowns: Array.isArray(data.unknowns) ? data.unknowns : [],
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
      explanation: Array.isArray(data.explanation) ? data.explanation : [],
      confidence: data.confidence !== undefined ? data.confidence : 100,
      algorithm_version: data.algorithm_version || 'v5.0.0-deterministic',
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
      score: data.overall_score !== undefined ? data.overall_score : data.score || 0,
      factors: data.factors || {},
      eligible: data.eligibility_status === 'eligible' || data.eligible === true,
    };
  }
}

export const matchService = new MatchService();
