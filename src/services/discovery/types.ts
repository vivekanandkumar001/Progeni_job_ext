export type JobProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workday'
  | 'manual'
  | 'extension'
  | 'other';

export type JobStatus = 'active' | 'expired' | 'closed' | 'paused' | 'unverified';

export type WorkplaceMode = 'remote' | 'hybrid' | 'office';

export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship' | 'other';

export interface NormalizedJob {
  id: string; // Internal UUID
  job_id: string; // Same as id
  external_job_id: string | null;
  provider: JobProvider;
  company_name: string;
  job_title: string;
  job_description: string;
  responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  experience_min: number | null;
  experience_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  employment_type: EmploymentType;
  workplace_mode: WorkplaceMode;
  location: string | null;
  country: string | null;
  application_url: string;
  original_source_url: string;
  canonical_url: string;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_verified_at: string;
  status: JobStatus;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export type JobDocument = Omit<NormalizedJob, 'id'> & { _id: string };

export interface RawJobPosting {
  externalId?: string | number | null;
  provider: JobProvider;
  companyName: string;
  title: string;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  locationRaw?: string | null;
  applyUrl: string;
  sourceUrl?: string | null;
  postedAt?: string | Date | null;
  employmentTypeRaw?: string | null;
  workplaceModeRaw?: string | null;
  salaryRaw?: string | null;
  skillsRaw?: string[] | null;
}

export interface JobDiscoverySource {
  id: string;
  provider: JobProvider;
  identifier: string; // e.g. company token 'stripe', 'figma', 'airbnb'
  company_name: string;
  url: string;
  active: boolean;
  last_crawled_at: string | null;
  jobs_discovered: number;
  created_at: string;
  updated_at: string;
}

export interface JobDiscoveryRunMetrics {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  providers_queried: string[];
  jobs_found: number;
  jobs_inserted: number;
  jobs_updated: number;
  errors: Array<{ provider: string; identifier?: string; error: string }>;
}

export interface CandidateSavedJob {
  id: string;
  user_id: string;
  job_id: string;
  notes?: string | null;
  created_at: string;
}

export interface JobProviderAdapter {
  readonly provider: JobProvider;
  readonly name: string;
  fetchJobs(source: JobDiscoverySource): Promise<RawJobPosting[]>;
}

