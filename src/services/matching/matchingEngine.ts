import { randomUUID } from 'node:crypto';
import { hardEligibilityEngine } from './eligibilityEngine.js';
import {
  mapToCanonicalSkills,
  normalizeSkill,
  skillsMatch,
  SKILL_TAXONOMY_VERSION,
} from './skillTaxonomy.js';
import type {
  DeterministicMatchResult,
  DimensionScores,
  DimensionWeights,
  EducationMatchDetail,
  ExperienceMatchDetail,
  LocationMatchDetail,
  SalaryMatchDetail,
  SkillMatchDetail,
} from './types.js';
import { DEFAULT_DIMENSION_WEIGHTS } from './types.js';

export const MATCH_ALGORITHM_VERSION = `v5.0.0-deterministic+tax:${SKILL_TAXONOMY_VERSION}`;

export interface CandidateMatchingProfile {
  id: string;
  user_id: string;
  target_role?: string | null;
  skills?: string[];
  experience_years?: number | null;
  education?: Array<{ degree: string; fieldOfStudy?: string }>;
  city?: string | null;
  country?: string | null;
  location?: string | null;
  desired_roles?: string[];
  preferred_locations?: string[];
  workplace_type?: 'remote' | 'hybrid' | 'office' | 'any';
  expected_salary_min?: number | null;
  expected_salary_currency?: string | null;
  verified_skills?: string[]; // from truth engine
}

export interface JobMatchingPosting {
  id: string;
  job_title: string;
  company_name: string;
  job_description?: string;
  required_skills?: string[];
  preferred_skills?: string[];
  mandatory_skills?: string[];
  experience_min?: number | null;
  experience_max?: number | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  location?: string | null;
  country?: string | null;
  workplace_mode?: 'remote' | 'hybrid' | 'office';
  employment_type?: string;
  status?: string;
}

export class MatchingEngine {
  private weights: DimensionWeights;

  constructor(weights: DimensionWeights = DEFAULT_DIMENSION_WEIGHTS) {
    this.weights = weights;
  }

  evaluateMatch(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): DeterministicMatchResult {
    const warnings: string[] = [];
    const unknowns: string[] = [];
    const explanation: string[] = [];
    let confidence = 100;

    // --- 1. SKILLS ALIGNMENT (30%) ---
    const {
      skillsScore,
      matchedSkills,
      missingRequired,
      missingPreferred,
      skillDetails,
      skillExplanation,
    } = this.evaluateSkills(candidate, job);
    explanation.push(...skillExplanation);

    // --- 2. EXPERIENCE ELIGIBILITY (20%) ---
    const { expScore, expDetails, expWarnings, expUnknowns } = this.evaluateExperience(
      candidate,
      job,
    );
    warnings.push(...expWarnings);
    unknowns.push(...expUnknowns);
    explanation.push(expDetails.note);

    // --- 3. ROLE RELEVANCE (20%) ---
    const { roleScore, roleNote } = this.evaluateRole(candidate, job);
    explanation.push(roleNote);

    // --- 4. EDUCATION ELIGIBILITY (10%) ---
    const { eduScore, eduDetails, eduUnknowns } = this.evaluateEducation(candidate, job);
    unknowns.push(...eduUnknowns);
    explanation.push(eduDetails.note);

    // --- 5. LOCATION COMPATIBILITY (10%) ---
    const { locScore, locDetails } = this.evaluateLocation(candidate, job);
    explanation.push(locDetails.note);

    // --- 6. SALARY COMPATIBILITY (10%) ---
    const { salScore, salDetails, salConfidencePenalty } = this.evaluateSalary(candidate, job);
    explanation.push(salDetails.note);
    if (salConfidencePenalty) confidence -= salConfidencePenalty;

    // Adjust confidence for missing inputs
    if (candidate.experience_years === null || candidate.experience_years === undefined) {
      confidence -= 15;
    }
    if (job.experience_min === null || job.experience_min === undefined) {
      confidence -= 10;
    }
    if (!candidate.skills || candidate.skills.length === 0) {
      confidence -= 20;
    }
    confidence = Math.max(20, Math.min(100, confidence));

    const dimension_scores: DimensionScores = {
      skills_alignment: Math.max(0, Math.min(100, Math.round(skillsScore))),
      experience_eligibility: Math.max(0, Math.min(100, Math.round(expScore))),
      role_relevance: Math.max(0, Math.min(100, Math.round(roleScore))),
      education_eligibility: Math.max(0, Math.min(100, Math.round(eduScore))),
      location_compatibility: Math.max(0, Math.min(100, Math.round(locScore))),
      salary_compatibility: Math.max(0, Math.min(100, Math.round(salScore))),
    };

    // Calculate deterministic weighted score
    const weightedScore =
      dimension_scores.skills_alignment * this.weights.skills +
      dimension_scores.experience_eligibility * this.weights.experience +
      dimension_scores.role_relevance * this.weights.role +
      dimension_scores.education_eligibility * this.weights.education +
      dimension_scores.location_compatibility * this.weights.location +
      dimension_scores.salary_compatibility * this.weights.salary;

    const overall_score = Math.max(0, Math.min(100, Math.round(weightedScore)));

    // Run Hard Eligibility Engine
    const hardResult = hardEligibilityEngine.evaluate({
      candidate: {
        skills: candidate.skills || [],
        experience_years: candidate.experience_years ?? null,
        location: candidate.location,
        country: candidate.country,
      },
      job: {
        mandatory_skills: job.mandatory_skills || job.required_skills,
        experience_min: job.experience_min,
        location: job.location,
        workplace_mode: job.workplace_mode,
      },
    });

    const now = new Date().toISOString();
    const matchId = `match_${candidate.user_id}_${job.id}`;

    return {
      id: matchId,
      user_id: candidate.user_id,
      candidate_id: candidate.user_id,
      job_id: job.id,
      overall_score,
      dimension_scores,
      eligibility_status: hardResult.decision,
      matched_skills: matchedSkills,
      missing_required_skills: missingRequired,
      missing_preferred_skills: missingPreferred,
      skill_details: skillDetails,
      experience_details: expDetails,
      education_details: eduDetails,
      location_details: locDetails,
      salary_details: salDetails,
      blockers: hardResult.blockers,
      unknowns: Array.from(new Set([...unknowns, ...hardResult.unknowns])),
      warnings: Array.from(new Set(warnings)),
      explanation,
      confidence,
      algorithm_version: MATCH_ALGORITHM_VERSION,
      created_at: now,
      updated_at: now,
      // Legacy compatibility
      score: overall_score,
      factors: {
        skills: dimension_scores.skills_alignment,
        experience: dimension_scores.experience_eligibility,
        role: dimension_scores.role_relevance,
        education: dimension_scores.education_eligibility,
        location: dimension_scores.location_compatibility,
        salary: dimension_scores.salary_compatibility,
      },
      eligible: hardResult.eligible,
    };
  }

  private evaluateSkills(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): {
    skillsScore: number;
    matchedSkills: string[];
    missingRequired: string[];
    missingPreferred: string[];
    skillDetails: SkillMatchDetail[];
    skillExplanation: string[];
  } {
    const candidateSkillsRaw = candidate.skills || [];
    const verifiedSkillsRaw = candidate.verified_skills || [];
    const verifiedSet = new Set(verifiedSkillsRaw.map((s) => normalizeSkill(s).toLowerCase()));

    const candidateCanonicalMap = new Map<string, string>(); // lowerCanonical -> originalName
    for (const raw of candidateSkillsRaw) {
      const canonical = normalizeSkill(raw);
      candidateCanonicalMap.set(canonical.toLowerCase(), raw);
    }

    const jobRequiredRaw = job.required_skills || [];
    const jobPreferredRaw = job.preferred_skills || [];

    const matchedSkills: string[] = [];
    const missingRequired: string[] = [];
    const missingPreferred: string[] = [];
    const skillDetails: SkillMatchDetail[] = [];

    // Evaluate Required Skills
    let matchedRequiredCount = 0;
    for (const raw of jobRequiredRaw) {
      const canonical = normalizeSkill(raw);
      const lower = canonical.toLowerCase();
      const hasSkill = candidateCanonicalMap.has(lower);

      if (hasSkill) {
        matchedRequiredCount++;
        matchedSkills.push(canonical);
        const isVerified = verifiedSet.has(lower);
        skillDetails.push({
          skill: raw,
          canonical,
          status: 'matched',
          importance: 'required',
          provenance: isVerified ? 'verified_claim' : 'profile',
          evidence: isVerified ? 'Backed by verified resume claim' : 'Stated in candidate profile',
        });
      } else {
        missingRequired.push(canonical);
        skillDetails.push({
          skill: raw,
          canonical,
          status: 'missing',
          importance: 'required',
        });
      }
    }

    // Evaluate Preferred Skills
    let matchedPreferredCount = 0;
    for (const raw of jobPreferredRaw) {
      const canonical = normalizeSkill(raw);
      const lower = canonical.toLowerCase();
      const hasSkill = candidateCanonicalMap.has(lower);

      if (hasSkill) {
        matchedPreferredCount++;
        if (!matchedSkills.includes(canonical)) matchedSkills.push(canonical);
        const isVerified = verifiedSet.has(lower);
        skillDetails.push({
          skill: raw,
          canonical,
          status: 'matched',
          importance: 'preferred',
          provenance: isVerified ? 'verified_claim' : 'profile',
        });
      } else {
        missingPreferred.push(canonical);
        skillDetails.push({
          skill: raw,
          canonical,
          status: 'missing',
          importance: 'preferred',
        });
      }
    }

    let skillsScore = 0;
    const skillExplanation: string[] = [];

    if (jobRequiredRaw.length > 0) {
      const requiredRatio = matchedRequiredCount / jobRequiredRaw.length;
      const preferredRatio =
        jobPreferredRaw.length > 0 ? matchedPreferredCount / jobPreferredRaw.length : 1;
      // 80% weight on required, 20% on preferred
      skillsScore = Math.round(requiredRatio * 85 + (jobPreferredRaw.length ? preferredRatio * 15 : 15));
      skillExplanation.push(
        `Skills: Matched ${matchedRequiredCount}/${jobRequiredRaw.length} required skills (${Math.round(requiredRatio * 100)}%).`,
      );
    } else if (candidateSkillsRaw.length > 0) {
      // Fallback description match
      const descLower = (job.job_description || '').toLowerCase();
      const mentioned = candidateSkillsRaw.filter((s) => descLower.includes(s.toLowerCase()));
      if (mentioned.length > 0) {
        skillsScore = Math.min(85, mentioned.length * 20);
        skillExplanation.push(`Skills: Found ${mentioned.length} profile skills mentioned in description.`);
      } else {
        skillsScore = 50;
        skillExplanation.push('Skills: No explicit required skills stated in posting; neutral score.');
      }
    } else {
      skillsScore = 40;
      skillExplanation.push('Skills: Neither job nor candidate lists required skills; please add skills.');
    }

    return {
      skillsScore: Math.max(0, Math.min(100, skillsScore)),
      matchedSkills,
      missingRequired,
      missingPreferred,
      skillDetails,
      skillExplanation,
    };
  }

  private evaluateExperience(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): {
    expScore: number;
    expDetails: ExperienceMatchDetail;
    expWarnings: string[];
    expUnknowns: string[];
  } {
    const candidateYears = candidate.experience_years ?? null;
    const minYears = job.experience_min ?? null;
    const maxYears = job.experience_max ?? null;
    const expWarnings: string[] = [];
    const expUnknowns: string[] = [];

    if (minYears === null && maxYears === null) {
      return {
        expScore: 90,
        expDetails: {
          candidate_years: candidateYears,
          job_min_years: null,
          job_max_years: null,
          status: 'meets',
          note: 'Experience: No minimum experience required by employer.',
        },
        expWarnings,
        expUnknowns,
      };
    }

    if (candidateYears === null) {
      expUnknowns.push('Candidate years of experience is not provided in profile.');
      return {
        expScore: 50,
        expDetails: {
          candidate_years: null,
          job_min_years: minYears,
          job_max_years: maxYears,
          status: 'unknown',
          note: `Experience: Requires ${minYears || 0}+ years; candidate experience is unstated.`,
        },
        expWarnings,
        expUnknowns,
      };
    }

    const minRequired = minYears || 0;

    if (candidateYears >= minRequired) {
      if (maxYears !== null && candidateYears > maxYears + 4) {
        // Significantly overqualified
        expWarnings.push(
          `Candidate has ${candidateYears} years of experience for a role capped at ${maxYears} years.`,
        );
        return {
          expScore: 85,
          expDetails: {
            candidate_years: candidateYears,
            job_min_years: minYears,
            job_max_years: maxYears,
            status: 'above_max',
            note: `Experience: Candidate has ${candidateYears} years (exceeds stated band of ${minYears}-${maxYears} years).`,
          },
          expWarnings,
          expUnknowns,
        };
      }

      return {
        expScore: 100,
        expDetails: {
          candidate_years: candidateYears,
          job_min_years: minYears,
          job_max_years: maxYears,
          status: 'meets',
          note: `Experience: ${candidateYears} years meets the requirement of ${minYears}+ years.`,
        },
        expWarnings,
        expUnknowns,
      };
    }

    // Candidate below minimum experience
    const gap = minRequired - candidateYears;
    const ratio = Math.max(0, candidateYears / Math.max(1, minRequired));
    const score = Math.round(ratio * 70);

    return {
      expScore: Math.max(0, score),
      expDetails: {
        candidate_years: candidateYears,
        job_min_years: minYears,
        job_max_years: maxYears,
        status: 'below',
        note: `Experience: Candidate has ${candidateYears} years, which is ${gap} years below the required ${minRequired} years.`,
      },
      expWarnings,
      expUnknowns,
    };
  }

  private evaluateRole(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): { roleScore: number; roleNote: string } {
    const candidateRoles = (candidate.desired_roles || []).concat(
      candidate.target_role ? [candidate.target_role] : [],
    );

    if (candidateRoles.length === 0) {
      return {
        roleScore: 60,
        roleNote: 'Role: Target role not specified in candidate profile.',
      };
    }

    const jobTitleLower = job.job_title.toLowerCase();

    for (const role of candidateRoles) {
      const roleLower = role.toLowerCase();
      if (jobTitleLower === roleLower || jobTitleLower.includes(roleLower) || roleLower.includes(jobTitleLower)) {
        return {
          roleScore: 100,
          roleNote: `Role: Job title "${job.job_title}" directly matches desired role "${role}".`,
        };
      }
    }

    // Word token overlap check
    const jobTokens = new Set(jobTitleLower.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
    let bestOverlap = 0;

    for (const role of candidateRoles) {
      const roleTokens = role.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
      const overlap = roleTokens.filter((t) => jobTokens.has(t)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
      }
    }

    if (bestOverlap >= 2) {
      return {
        roleScore: 80,
        roleNote: `Role: High title relevance to target preferences.`,
      };
    } else if (bestOverlap === 1) {
      return {
        roleScore: 60,
        roleNote: `Role: Partial keyword overlap with candidate target roles.`,
      };
    }

    return {
      roleScore: 30,
      roleNote: `Role: Title "${job.job_title}" does not closely align with candidate target roles.`,
    };
  }

  private evaluateEducation(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): { eduScore: number; eduDetails: EducationMatchDetail; eduUnknowns: string[] } {
    const candidateDegrees = (candidate.education || []).map((e) => e.degree.toLowerCase());
    const descLower = (job.job_description || '').toLowerCase();
    const eduUnknowns: string[] = [];

    const requiresMaster = descLower.includes('master') || descLower.includes('ms degree') || descLower.includes('m.tech');
    const requiresDoctorate = descLower.includes('phd') || descLower.includes('doctorate');
    const requiresBachelor = descLower.includes('bachelor') || descLower.includes('bs degree') || descLower.includes('b.tech') || descLower.includes('degree in computer science');

    if (candidateDegrees.length === 0) {
      eduUnknowns.push('Candidate education history is unstated.');
      return {
        eduScore: 70,
        eduDetails: {
          candidate_degrees: [],
          required_degree: requiresMaster ? 'Masters' : requiresBachelor ? 'Bachelors' : null,
          status: 'unknown',
          note: 'Education: Candidate education details not provided; evaluated as neutral.',
        },
        eduUnknowns,
      };
    }

    const hasDoctorate = candidateDegrees.some((d) => d.includes('phd') || d.includes('doctorate'));
    const hasMaster = candidateDegrees.some((d) => d.includes('master') || d.includes('ms') || d.includes('m.tech') || d.includes('mba'));
    const hasBachelor = candidateDegrees.some((d) => d.includes('bachelor') || d.includes('bs') || d.includes('b.tech') || d.includes('b.e'));

    if (requiresDoctorate) {
      if (hasDoctorate) {
        return {
          eduScore: 100,
          eduDetails: { candidate_degrees: candidateDegrees, required_degree: 'PhD', status: 'meets', note: 'Education: Meets doctorate requirement.' },
          eduUnknowns,
        };
      }
      return {
        eduScore: 50,
        eduDetails: { candidate_degrees: candidateDegrees, required_degree: 'PhD', status: 'below', note: 'Education: Position prefers or requires PhD/Doctorate.' },
        eduUnknowns,
      };
    }

    if (requiresMaster) {
      if (hasMaster || hasDoctorate) {
        return {
          eduScore: 100,
          eduDetails: { candidate_degrees: candidateDegrees, required_degree: 'Masters', status: 'meets', note: 'Education: Candidate holds required advanced degree.' },
          eduUnknowns,
        };
      }
      return {
        eduScore: 65,
        eduDetails: { candidate_degrees: candidateDegrees, required_degree: 'Masters', status: 'below', note: 'Education: Masters degree preferred; candidate holds Bachelors.' },
        eduUnknowns,
      };
    }

    return {
      eduScore: 100,
      eduDetails: {
        candidate_degrees: candidateDegrees,
        required_degree: requiresBachelor ? 'Bachelors' : null,
        status: 'meets',
        note: 'Education: Candidate education meets position requirements.',
      },
      eduUnknowns,
    };
  }

  private evaluateLocation(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): { locScore: number; locDetails: LocationMatchDetail } {
    const candidatePrefMode = candidate.workplace_type || 'remote';
    const jobMode = job.workplace_mode || 'office';
    const candidateLocs = (candidate.preferred_locations || []).map((l) => l.toLowerCase());
    if (candidate.city) candidateLocs.push(candidate.city.toLowerCase());

    // If job is Remote, 100% compatible
    if (jobMode === 'remote') {
      return {
        locScore: 100,
        locDetails: {
          candidate_locations: candidateLocs,
          candidate_mode: candidatePrefMode,
          job_location: job.location || 'Remote',
          job_mode: 'remote',
          status: 'remote_eligible',
          note: 'Location: Fully remote position; candidate is eligible.',
        },
      };
    }

    const jobLocLower = (job.location || '').toLowerCase();
    const locMatch = candidateLocs.some((loc) => jobLocLower.includes(loc) || loc.includes(jobLocLower));

    if (locMatch) {
      return {
        locScore: 100,
        locDetails: {
          candidate_locations: candidateLocs,
          candidate_mode: candidatePrefMode,
          job_location: job.location || null,
          job_mode: jobMode,
          status: 'compatible',
          note: `Location: Job location (${job.location}) matches candidate preferred location.`,
        },
      };
    }

    if (candidatePrefMode === 'remote' && jobMode === 'office') {
      return {
        locScore: 35,
        locDetails: {
          candidate_locations: candidateLocs,
          candidate_mode: candidatePrefMode,
          job_location: job.location || null,
          job_mode: jobMode,
          status: 'incompatible',
          note: `Location: Candidate prefers remote work, but position is on-site in ${job.location || 'office'}.`,
        },
      };
    }

    return {
      locScore: 60,
      locDetails: {
        candidate_locations: candidateLocs,
        candidate_mode: candidatePrefMode,
        job_location: job.location || null,
        job_mode: jobMode,
        status: 'unknown',
        note: `Location: Located in ${job.location || 'unlisted'}; verify relocation or commuting feasibility.`,
      },
    };
  }

  private evaluateSalary(
    candidate: CandidateMatchingProfile,
    job: JobMatchingPosting,
  ): { salScore: number; salDetails: SalaryMatchDetail; salConfidencePenalty?: number } {
    const candMin = candidate.expected_salary_min ?? null;
    const candCurrency = candidate.expected_salary_currency || 'USD';
    const jobMin = job.salary_min ?? null;
    const jobMax = job.salary_max ?? null;
    const jobCurrency = job.salary_currency || 'USD';

    if (jobMin === null && jobMax === null) {
      return {
        salScore: 75,
        salDetails: {
          candidate_min: candMin,
          candidate_currency: candCurrency,
          job_min: null,
          job_max: null,
          job_currency: null,
          status: 'salary_unlisted',
          note: 'Salary: Compensation is not publicly disclosed in posting (neutral rating).',
        },
        salConfidencePenalty: 10,
      };
    }

    if (candMin === null) {
      return {
        salScore: 80,
        salDetails: {
          candidate_min: null,
          candidate_currency: candCurrency,
          job_min: jobMin,
          job_max: jobMax,
          job_currency: jobCurrency,
          status: 'candidate_salary_unlisted',
          note: `Salary: Posting offers ${jobCurrency} ${jobMin || 0} - ${jobMax || 0}; candidate expectations unstated.`,
        },
      };
    }

    const effectiveJobMax = jobMax || jobMin || 0;

    if (effectiveJobMax >= candMin) {
      return {
        salScore: 100,
        salDetails: {
          candidate_min: candMin,
          candidate_currency: candCurrency,
          job_min: jobMin,
          job_max: jobMax,
          job_currency: jobCurrency,
          status: 'meets_expectations',
          note: `Salary: Offered compensation (${jobCurrency} ${jobMin || 0} - ${effectiveJobMax}) meets or exceeds expected minimum (${candCurrency} ${candMin}).`,
        },
      };
    }

    const ratio = Math.max(0, effectiveJobMax / Math.max(1, candMin));
    const score = Math.round(ratio * 70);

    return {
      salScore: Math.max(0, score),
      salDetails: {
        candidate_min: candMin,
        candidate_currency: candCurrency,
        job_min: jobMin,
        job_max: jobMax,
        job_currency: jobCurrency,
        status: 'below_expectations',
        note: `Salary: Offered compensation top of band (${jobCurrency} ${effectiveJobMax}) is below candidate expectation (${candCurrency} ${candMin}).`,
      },
    };
  }
}

export const matchingEngine = new MatchingEngine();
