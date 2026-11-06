import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';
import { candidatePreferencesService } from './candidatePreferencesService.js';
import { candidateProfileService } from './candidateProfileService.js';
import { manualImportAdapter, type ManualJobImportInput } from './discovery/adapters/manualImportAdapter.js';
import { discoveryEngine } from './discovery/discoveryEngine.js';
import { JobDeduplicationService } from './discovery/jobDeduplicationService.js';
import { JobNormalizationService } from './discovery/jobNormalizationService.js';
import type {
  CandidateSavedJob,
  EmploymentType,
  JobDiscoveryRunMetrics,
  JobDiscoverySource,
  JobDocument,
  JobProvider,
  JobStatus,
  NormalizedJob,
  WorkplaceMode,
} from './discovery/types.js';

const JOBS_TABLE = 'jobs';
const SAVED_JOBS_TABLE = 'candidate_saved_jobs';

export interface JobSearchParams {
  q?: string;
  role?: string;
  location?: string;
  workplace_mode?: WorkplaceMode;
  employment_type?: EmploymentType;
  min_salary?: number;
  max_salary?: number;
  provider?: JobProvider;
  status?: JobStatus;
  skills?: string[];
  personalized?: boolean;
  page?: number;
  limit?: number;
}

export interface JobSearchResultItem extends NormalizedJob {
  // Legacy aliases
  company?: string;
  title?: string;
  url?: string;
  skills?: string[];
  is_saved?: boolean;
  personalized_score?: number;
  match_reasons?: string[];
}

export interface JobSearchResult {
  jobs: JobSearchResultItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isPersonalized: boolean;
}

export class JobDiscoveryService {
  private normalizer = new JobNormalizationService();
  private deduplicator = new JobDeduplicationService();

  async searchJobs(params: JobSearchParams, candidateUserId?: string): Promise<JobSearchResult> {
    const db = await getDatabase();
    const collection = db.collection<any>(JOBS_TABLE);

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};

    // By default, only return active jobs unless explicit status provided
    if (params.status) {
      filter.status = params.status;
    } else {
      filter.status = { $in: ['active', null, undefined] };
    }

    if (params.provider) {
      filter.provider = params.provider;
    }

    if (params.workplace_mode) {
      filter.workplace_mode = params.workplace_mode;
    }

    if (params.employment_type) {
      filter.employment_type = params.employment_type;
    }

    if (params.min_salary) {
      filter.$or = [
        { salary_min: { $gte: Number(params.min_salary) } },
        { salary_max: { $gte: Number(params.min_salary) } },
      ];
    }

    if (params.location) {
      filter.location = { $regex: params.location, $options: 'i' };
    }

    if (params.role) {
      filter.$or = [
        { job_title: { $regex: params.role, $options: 'i' } },
        { title: { $regex: params.role, $options: 'i' } },
      ];
    }

    if (params.q && params.q.trim()) {
      const qRegex = { $regex: params.q.trim(), $options: 'i' };
      filter.$or = [
        { job_title: qRegex },
        { title: qRegex },
        { company_name: qRegex },
        { company: qRegex },
        { job_description: qRegex },
        { required_skills: qRegex },
        { skills: qRegex },
      ];
    }

    if (params.skills && params.skills.length > 0) {
      filter.$or = [
        { required_skills: { $in: params.skills } },
        { skills: { $in: params.skills } },
      ];
    }

    const isPersonalized = Boolean(params.personalized && candidateUserId);

    let jobs: JobSearchResultItem[] = [];
    let total = 0;

    if (isPersonalized && candidateUserId) {
      // Fetch user profile and preferences for personalization
      const [preferences, profile] = await Promise.all([
        candidatePreferencesService.get(candidateUserId),
        candidateProfileService.get(candidateUserId),
      ]);

      // Fetch candidates pool (up to 200 matching filter)
      const rawCandidates = await collection
        .find(filter)
        .sort({ posted_at: -1, created_at: -1 })
        .limit(200)
        .toArray();

      const candidateRoles = (preferences?.desired_roles || []).concat(
        profile?.target_role ? [profile.target_role] : [],
      );
      const candidateSkills = (profile?.skills || []).map((s) => s.toLowerCase());
      const prefLocations = (preferences?.preferred_locations || []).map((l) => l.toLowerCase());
      const prefWorkplace = preferences?.workplace_type;
      const expectedSalaryMin = preferences?.expected_salary?.min;

      const scored = rawCandidates.map((doc) => {
        const row = this.toRow(doc);
        const { score, reasons } = this.calculatePersonalizedScore(row, {
          candidateRoles,
          candidateSkills,
          prefLocations,
          prefWorkplace,
          expectedSalaryMin,
        });

        return {
          ...row,
          personalized_score: score,
          match_reasons: reasons,
        };
      });

      // Sort by score descending
      scored.sort((a, b) => (b.personalized_score || 0) - (a.personalized_score || 0));

      total = scored.length;
      jobs = scored.slice(skip, skip + limit);
    } else {
      total = await collection.countDocuments(filter);
      const docs = await collection
        .find(filter)
        .sort({ posted_at: -1, created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      jobs = docs.map((d) => this.toRow(d));
    }

    // Check saved status if user authenticated
    if (candidateUserId && jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const savedDocs = await db
        .collection<CandidateSavedJob>(SAVED_JOBS_TABLE)
        .find({ user_id: candidateUserId, job_id: { $in: jobIds } })
        .toArray();

      const savedSet = new Set(savedDocs.map((s) => s.job_id));
      for (const job of jobs) {
        job.is_saved = savedSet.has(job.id);
      }
    }

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      isPersonalized,
    };
  }

  async getJobById(
    jobId: string,
    candidateUserId?: string,
  ): Promise<JobSearchResultItem | null> {
    const db = await getDatabase();
    const doc = await db.collection<any>(JOBS_TABLE).findOne({ _id: jobId });
    if (!doc) return null;

    const row: JobSearchResultItem = this.toRow(doc);

    if (candidateUserId) {
      const saved = await db.collection<CandidateSavedJob>(SAVED_JOBS_TABLE).findOne({
        user_id: candidateUserId,
        job_id: jobId,
      });
      row.is_saved = Boolean(saved);

      const [preferences, profile] = await Promise.all([
        candidatePreferencesService.get(candidateUserId),
        candidateProfileService.get(candidateUserId),
      ]);

      const candidateRoles = (preferences?.desired_roles || []).concat(
        profile?.target_role ? [profile.target_role] : [],
      );
      const candidateSkills = (profile?.skills || []).map((s) => s.toLowerCase());
      const prefLocations = (preferences?.preferred_locations || []).map((l) => l.toLowerCase());
      const prefWorkplace = preferences?.workplace_type;
      const expectedSalaryMin = preferences?.expected_salary?.min;

      const { score, reasons } = this.calculatePersonalizedScore(row, {
        candidateRoles,
        candidateSkills,
        prefLocations,
        prefWorkplace,
        expectedSalaryMin,
      });

      row.personalized_score = score;
      row.match_reasons = reasons;
    }

    return row;
  }

  async saveJob(userId: string, jobId: string, notes?: string): Promise<CandidateSavedJob> {
    const db = await getDatabase();
    // Verify job exists
    const job = await db.collection<any>(JOBS_TABLE).findOne({ _id: jobId as any });
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const now = new Date().toISOString();
    const savedDoc: CandidateSavedJob & { _id: string } = {
      _id: `${userId}:${jobId}`,
      id: `${userId}:${jobId}`,
      user_id: userId,
      job_id: jobId,
      notes: notes?.trim() || null,
      created_at: now,
    };

    await db.collection<any>(SAVED_JOBS_TABLE).updateOne(
      { _id: savedDoc._id as any },
      { $set: savedDoc },
      { upsert: true },
    );

    return {
      id: savedDoc.id,
      user_id: savedDoc.user_id,
      job_id: savedDoc.job_id,
      notes: savedDoc.notes,
      created_at: savedDoc.created_at,
    };
  }

  async unsaveJob(userId: string, jobId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.collection(SAVED_JOBS_TABLE).deleteOne({
      user_id: userId,
      job_id: jobId,
    });
    return result.deletedCount > 0;
  }

  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    const db = await getDatabase();
    const count = await db.collection(SAVED_JOBS_TABLE).countDocuments({
      user_id: userId,
      job_id: jobId,
    });
    return count > 0;
  }

  async listSavedJobs(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ saved_jobs: Array<CandidateSavedJob & { job: NormalizedJob | null }>; total: number }> {
    const db = await getDatabase();
    const skip = (Math.max(1, page) - 1) * limit;

    const total = await db.collection(SAVED_JOBS_TABLE).countDocuments({ user_id: userId });
    const savedDocs = await db
      .collection<CandidateSavedJob>(SAVED_JOBS_TABLE)
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const jobIds = savedDocs.map((s) => s.job_id);
    const jobsDocs = await db
      .collection<any>(JOBS_TABLE)
      .find({ _id: { $in: jobIds } })
      .toArray();

    const jobMap = new Map<string, NormalizedJob>();
    for (const d of jobsDocs) {
      jobMap.set(d._id, this.toRow(d));
    }

    const saved_jobs = savedDocs.map((s) => ({
      id: s.id || `${s.user_id}:${s.job_id}`,
      user_id: s.user_id,
      job_id: s.job_id,
      notes: s.notes || null,
      created_at: s.created_at,
      job: jobMap.get(s.job_id) || null,
    }));

    return { saved_jobs, total };
  }

  async importJob(
    userId: string,
    input: ManualJobImportInput,
    provider: JobProvider = 'manual',
  ): Promise<NormalizedJob> {
    const raw = manualImportAdapter.createRawPosting(input, provider);
    const normalized = this.normalizer.normalize(raw);
    const result = await this.deduplicator.deduplicateAndSave(normalized);
    return result.job;
  }

  async triggerDiscovery(options?: {
    providers?: JobProvider[];
    sourceIds?: string[];
  }): Promise<JobDiscoveryRunMetrics> {
    return discoveryEngine.runDiscovery(options);
  }

  async getDiscoveryStatus(): Promise<{
    latest_run: JobDiscoveryRunMetrics | null;
    sources: JobDiscoverySource[];
  }> {
    const [latest_run, sources] = await Promise.all([
      discoveryEngine.getLatestRunMetrics(),
      discoveryEngine.listSources(),
    ]);
    return { latest_run, sources };
  }

  private calculatePersonalizedScore(
    job: NormalizedJob,
    candidate: {
      candidateRoles: string[];
      candidateSkills: string[];
      prefLocations: string[];
      prefWorkplace?: string;
      expectedSalaryMin?: number | null;
    },
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Role match (up to 35 pts)
    const titleLower = job.job_title.toLowerCase();
    const roleMatched = candidate.candidateRoles.some((role) =>
      titleLower.includes(role.toLowerCase()),
    );
    if (roleMatched) {
      score += 35;
      reasons.push('Matches desired role');
    }

    // 2. Skills overlap (up to 35 pts)
    const jobSkills = (job.required_skills || []).map((s) => s.toLowerCase());
    if (jobSkills.length > 0 && candidate.candidateSkills.length > 0) {
      const matched = jobSkills.filter((s) => candidate.candidateSkills.includes(s));
      const ratio = matched.length / jobSkills.length;
      const pts = Math.min(35, Math.round(ratio * 35));
      if (pts > 0) {
        score += pts;
        reasons.push(`Matches ${matched.length}/${jobSkills.length} required skills`);
      }
    } else if (candidate.candidateSkills.length > 0) {
      // Check description text for skills
      const descLower = job.job_description.toLowerCase();
      const matched = candidate.candidateSkills.filter((s) => descLower.includes(s));
      if (matched.length > 0) {
        const pts = Math.min(25, matched.length * 5);
        score += pts;
        reasons.push(`Skills mentioned: ${matched.slice(0, 3).join(', ')}`);
      }
    }

    // 3. Workplace Mode Match (up to 15 pts)
    if (candidate.prefWorkplace && candidate.prefWorkplace !== 'any') {
      if (candidate.prefWorkplace === job.workplace_mode) {
        score += 15;
        reasons.push(`Matches workplace preference (${job.workplace_mode})`);
      }
    } else {
      score += 10;
    }

    // 4. Location Match (up to 10 pts)
    if (candidate.prefLocations.length > 0 && job.location) {
      const jobLocLower = job.location.toLowerCase();
      const locMatch = candidate.prefLocations.some((loc) => jobLocLower.includes(loc));
      if (locMatch || job.workplace_mode === 'remote') {
        score += 10;
        reasons.push(job.workplace_mode === 'remote' ? 'Remote eligible' : 'Matches preferred location');
      }
    } else if (job.workplace_mode === 'remote') {
      score += 10;
      reasons.push('Remote eligible');
    }

    // 5. Salary Match (up to 5 pts)
    if (
      candidate.expectedSalaryMin &&
      job.salary_min &&
      job.salary_min >= candidate.expectedSalaryMin
    ) {
      score += 5;
      reasons.push('Meets salary expectations');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      reasons,
    };
  }

  toRow(doc: any): JobSearchResultItem {
    const { _id, ...rest } = doc;
    const company_name = rest.company_name || rest.company || 'Unknown Company';
    const job_title = rest.job_title || rest.title || 'Untitled Position';
    const application_url = rest.application_url || rest.url || '';
    const required_skills = Array.isArray(rest.required_skills)
      ? rest.required_skills
      : Array.isArray(rest.skills)
        ? rest.skills
        : [];

    return {
      ...rest,
      id: _id,
      job_id: _id,
      external_job_id: rest.external_job_id || null,
      provider: rest.provider || (rest.platform as any) || 'manual',
      company_name,
      job_title,
      // Legacy compatibility aliases
      company: company_name,
      title: job_title,
      url: application_url,
      skills: required_skills,
      job_description: rest.job_description || '',
      responsibilities: Array.isArray(rest.responsibilities) ? rest.responsibilities : [],
      required_skills,
      preferred_skills: Array.isArray(rest.preferred_skills) ? rest.preferred_skills : [],
      experience_min: typeof rest.experience_min === 'number' ? rest.experience_min : null,
      experience_max: typeof rest.experience_max === 'number' ? rest.experience_max : null,
      salary_min: typeof rest.salary_min === 'number' ? rest.salary_min : null,
      salary_max: typeof rest.salary_max === 'number' ? rest.salary_max : null,
      salary_currency: rest.salary_currency || null,
      employment_type: rest.employment_type || 'full-time',
      workplace_mode: rest.workplace_mode || 'office',
      location: rest.location || null,
      country: rest.country || null,
      application_url,
      original_source_url: rest.original_source_url || application_url,
      canonical_url: rest.canonical_url || application_url,
      posted_at: rest.posted_at || null,
      first_seen_at: rest.first_seen_at || rest.created_at || new Date().toISOString(),
      last_seen_at: rest.last_seen_at || rest.created_at || new Date().toISOString(),
      last_verified_at: rest.last_verified_at || rest.created_at || new Date().toISOString(),
      status: rest.status || 'active',
      content_hash: rest.content_hash || '',
      created_at: rest.created_at || new Date().toISOString(),
      updated_at: rest.updated_at || rest.created_at || new Date().toISOString(),
    };
  }
}

export const jobDiscoveryService = new JobDiscoveryService();
