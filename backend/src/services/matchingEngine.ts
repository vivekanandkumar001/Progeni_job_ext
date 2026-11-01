type RecordValue = Record<string, unknown>;

interface MatchScoreResult {
  score: number;
  factors: RecordValue;
  explanation: string[];
  missingEvidence: string[];
}

interface EligibilityResult {
  eligible: boolean;
  blockers: string[];
  unknowns: string[];
  evidence: string[];
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return undefined;
  }
  return value;
}

function getNumber(record: RecordValue, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function calculateMatchScore(factors: RecordValue): MatchScoreResult {
  const scoredFactors = Object.entries(factors).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );
  const missingEvidence = Object.keys(factors).filter(
    (key) => typeof factors[key] !== 'number' || !Number.isFinite(factors[key]),
  );
  const score =
    scoredFactors.length === 0
      ? 0
      : Math.round(
          scoredFactors.reduce((total, [, value]) => total + Math.max(0, Math.min(100, value)), 0) /
            scoredFactors.length,
        );
  const explanation = scoredFactors.map(
    ([name, value]) => `${name}: ${Math.max(0, Math.min(100, value))}/100`,
  );

  if (scoredFactors.length === 0) {
    explanation.push('No numeric scoring factors were provided.');
  }

  return { score, factors, explanation, missingEvidence };
}

export function checkHardEligibility(
  candidate: RecordValue,
  job: RecordValue,
): EligibilityResult {
  const blockers: string[] = [];
  const unknowns: string[] = [];
  const evidence: string[] = [];
  const candidateSkills = getStringArray(candidate.skills);
  const mandatorySkills = getStringArray(job.mandatorySkills ?? job.mandatory_skills);

  if (mandatorySkills === undefined) {
    if (job.mandatorySkills !== undefined || job.mandatory_skills !== undefined) {
      unknowns.push('Mandatory skills are not in a valid list format.');
    }
  } else if (mandatorySkills.length > 0 && candidateSkills === undefined) {
    unknowns.push('Candidate skills were not provided.');
  } else if (candidateSkills !== undefined) {
    const candidateSkillSet = new Set(candidateSkills.map((skill) => skill.toLowerCase()));
    const missingSkills = mandatorySkills.filter(
      (skill) => !candidateSkillSet.has(skill.toLowerCase()),
    );
    if (missingSkills.length > 0) {
      blockers.push(`Missing mandatory skills: ${missingSkills.join(', ')}.`);
    } else if (mandatorySkills.length > 0) {
      evidence.push('All mandatory skills are present.');
    }
  }

  const minimumExperience = getNumber(job, 'experienceMin', 'experience_min');
  if (minimumExperience !== undefined) {
    const candidateExperience = getNumber(candidate, 'experienceYears', 'experience_years');
    if (candidateExperience === undefined) {
      unknowns.push('Candidate experience is not known.');
    } else if (candidateExperience < minimumExperience) {
      blockers.push(`Requires at least ${minimumExperience} years of experience.`);
    } else {
      evidence.push('Candidate meets the minimum experience requirement.');
    }
  }

  return {
    eligible: blockers.length === 0 && unknowns.length === 0,
    blockers,
    unknowns,
    evidence,
  };
}
