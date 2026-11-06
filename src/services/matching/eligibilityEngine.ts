import type { EligibilityDecision } from './types.js';

export interface HardEligibilityInput {
  candidate: {
    skills: string[];
    experience_years: number | null;
    education_degrees?: string[];
    location?: string | null;
    country?: string | null;
    requires_visa_sponsorship?: boolean;
  };
  job: {
    mandatory_skills?: string[];
    experience_min?: number | null;
    requires_citizenship?: boolean;
    location?: string | null;
    workplace_mode?: string;
  };
}

export interface HardEligibilityResult {
  decision: EligibilityDecision;
  eligible: boolean; // boolean alias: true if eligible or potentially_eligible
  blockers: string[];
  unknowns: string[];
  evidence: string[];
}

export class HardEligibilityEngine {
  evaluate(input: HardEligibilityInput): HardEligibilityResult {
    const blockers: string[] = [];
    const unknowns: string[] = [];
    const evidence: string[] = [];

    const { candidate, job } = input;
    const candidateSkillSet = new Set(
      (candidate.skills || []).map((s) => s.trim().toLowerCase()),
    );

    // 1. Mandatory Skills Evaluation
    const mandatorySkills = job.mandatory_skills || [];
    if (mandatorySkills.length > 0) {
      if (!candidate.skills || candidate.skills.length === 0) {
        unknowns.push('Candidate skills were not provided to verify mandatory skills.');
      } else {
        const missingMandatory = mandatorySkills.filter(
          (skill) => !candidateSkillSet.has(skill.trim().toLowerCase()),
        );
        if (missingMandatory.length > 0) {
          blockers.push(`Missing mandatory skills: ${missingMandatory.join(', ')}.`);
        } else {
          evidence.push(`Verified all ${mandatorySkills.length} mandatory skills.`);
        }
      }
    }

    // 2. Minimum Experience Evaluation
    if (typeof job.experience_min === 'number' && job.experience_min > 0) {
      if (candidate.experience_years === null || candidate.experience_years === undefined) {
        unknowns.push(
          `Job requires ${job.experience_min} years of experience, but candidate experience is unstated.`,
        );
      } else if (candidate.experience_years < job.experience_min) {
        blockers.push(
          `Requires minimum ${job.experience_min} years of experience; candidate has ${candidate.experience_years} years.`,
        );
      } else {
        evidence.push(
          `Candidate experience (${candidate.experience_years} years) meets required minimum (${job.experience_min} years).`,
        );
      }
    }

    // 3. Work Authorization / Citizenship Evaluation
    if (job.requires_citizenship && candidate.requires_visa_sponsorship === true) {
      blockers.push('Position requires citizenship or existing work authorization without sponsorship.');
    }

    // 4. Decision Formulation
    let decision: EligibilityDecision = 'eligible';
    if (blockers.length > 0) {
      decision = 'ineligible';
    } else if (unknowns.length > 0) {
      decision = unknowns.length >= 2 ? 'insufficient_information' : 'potentially_eligible';
    } else {
      decision = 'eligible';
    }

    return {
      decision,
      eligible: blockers.length === 0 && decision !== 'insufficient_information',
      blockers,
      unknowns,
      evidence,
    };
  }
}

export const hardEligibilityEngine = new HardEligibilityEngine();
