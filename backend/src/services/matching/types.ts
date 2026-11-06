export type EligibilityDecision =
  | 'eligible'
  | 'potentially_eligible'
  | 'ineligible'
  | 'insufficient_information';

export interface DimensionScores {
  skills_alignment: number; // 0 - 100
  experience_eligibility: number; // 0 - 100
  role_relevance: number; // 0 - 100
  education_eligibility: number; // 0 - 100
  location_compatibility: number; // 0 - 100
  salary_compatibility: number; // 0 - 100
}

export interface DimensionWeights {
  skills: number; // 0.30
  experience: number; // 0.20
  role: number; // 0.20
  education: number; // 0.10
  location: number; // 0.10
  salary: number; // 0.10
}

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  skills: 0.30,
  experience: 0.20,
  role: 0.20,
  education: 0.10,
  location: 0.10,
  salary: 0.10,
};

export interface SkillMatchDetail {
  skill: string;
  canonical: string;
  status: 'matched' | 'missing';
  importance: 'required' | 'preferred';
  provenance?: 'master_resume' | 'verified_claim' | 'profile' | 'unverified';
  evidence?: string;
}

export interface ExperienceMatchDetail {
  candidate_years: number | null;
  job_min_years: number | null;
  job_max_years: number | null;
  status: 'meets' | 'below' | 'above_max' | 'unknown';
  note: string;
}

export interface EducationMatchDetail {
  candidate_degrees: string[];
  required_degree: string | null;
  status: 'meets' | 'below' | 'not_required' | 'unknown';
  note: string;
}

export interface LocationMatchDetail {
  candidate_locations: string[];
  candidate_mode: string;
  job_location: string | null;
  job_mode: string;
  status: 'compatible' | 'incompatible' | 'remote_eligible' | 'unknown';
  note: string;
}

export interface SalaryMatchDetail {
  candidate_min: number | null;
  candidate_currency: string | null;
  job_min: number | null;
  job_max: number | null;
  job_currency: string | null;
  status: 'meets_expectations' | 'below_expectations' | 'salary_unlisted' | 'candidate_salary_unlisted';
  note: string;
}

export interface DeterministicMatchResult {
  id: string;
  user_id: string;
  candidate_id: string; // Alias
  job_id: string;
  overall_score: number; // 0 - 100
  dimension_scores: DimensionScores;
  eligibility_status: EligibilityDecision;
  matched_skills: string[];
  missing_required_skills: string[];
  missing_preferred_skills: string[];
  skill_details: SkillMatchDetail[];
  experience_details: ExperienceMatchDetail;
  education_details: EducationMatchDetail;
  location_details: LocationMatchDetail;
  salary_details: SalaryMatchDetail;
  blockers: string[];
  unknowns: string[];
  warnings: string[];
  explanation: string[];
  confidence: number; // 0 - 100
  algorithm_version: string;
  created_at: string;
  updated_at: string;
  // Legacy aliases for backward compatibility
  score?: number;
  factors?: Record<string, unknown>;
  eligible?: boolean;
}

export type MatchDocument = Omit<DeterministicMatchResult, 'id'> & { _id: string };

export interface SkillGapItem {
  skill: string;
  canonical: string;
  demand_count: number;
  importance: 'required' | 'preferred';
  candidate_has_skill: boolean;
  provenance?: string;
  suggested_action: string;
}

