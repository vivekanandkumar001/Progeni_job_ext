import { atsRegistry } from './ats/registry.js';
import type { FormField } from './ats/types.js';

export interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  requiredSkills: string[];
  experienceMin: number | null;
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
}

export interface JobExtractionResult {
  supported: boolean;
  platform: string | null;
  policy: string;
  job: ExtractedJob | null;
  confidence: number;
  missingFields: string[];
  reason?: string;
  detectedFields?: FormField[];
  canAutoFill?: boolean;
}

const knownSkills = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust',
  'React', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker',
  'Kubernetes', 'Machine Learning', 'Deep Learning', 'Data Analysis',
  'HTML', 'CSS', 'Git', 'REST API', 'GraphQL', 'Excel', 'Communication',
  'Project Management', 'Leadership', 'Problem Solving', 'Teamwork',
  'Analytical', 'Creative', 'Detail-oriented', 'Organized',
];

function extractSkillsAndExperience(text: string): {
  requiredSkills: string[];
  experienceMin: number | null;
  matchedSkills: string[];
  missingSkills: string[];
} {
  const searchableText = text.toLocaleLowerCase();
  const foundSkills: string[] = [];

  // Check known skills
  const matchedKnownSkills = knownSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-z0-9])${escaped.toLocaleLowerCase()}([^a-z0-9]|$)`, 'i');
    if (regex.test(searchableText)) {
      foundSkills.push(skill);
      return true;
    }
    return false;
  });

  return {
    requiredSkills: matchedKnownSkills,
    experienceMin: extractExperienceMin(searchableText),
    matchedSkills: foundSkills,
    missingSkills: [], // Will be calculated comparing against candidate profile
  };
}

function extractExperienceMin(searchableText: string): number | null {
  const experienceMatch = searchableText.match(
    /(?:minimum|min\.?|at least)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+of)?\s+experience|(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i,
  );
  const experienceMin = experienceMatch
    ? Number(experienceMatch[1] || experienceMatch[2])
    : null;

  return Number.isFinite(experienceMin) ? experienceMin : null;
}

/** Compute a match score between a job and a candidate profile. */
export function computeMatchScore(
  job: ExtractedJob,
  candidateSkills: string[],
  candidateExperience: number | null,
): { score: number; matchedSkills: string[]; missingSkills: string[]; explanation: string[] } {
  const candidateSkillSet = new Set(
    candidateSkills.map((s) => s.toLowerCase()),
  );
  const matched: string[] = job.requiredSkills.filter((s) => candidateSkillSet.has(s.toLowerCase()));
  const missing: string[] = job.requiredSkills.filter((s) => !candidateSkillSet.has(s.toLowerCase()));

  // Base score from skill match (0-80 range)
  const skillScore = candidateSkills.length > 0
    ? Math.round((matched.length / Math.max(1, candidateSkills.length)) * 80)
    : 0;

  // Experience bonus (0-20 range)
  let experienceScore = 0;
  if (candidateExperience !== null && job.experienceMin !== null) {
    if (candidateExperience >= job.experienceMin) {
      experienceScore = 20;
    } else if (candidateExperience >= job.experienceMin * 0.7) {
      experienceScore = 10;
    }
  }

  // Skill count bonus (0-10 range) - candidates with more relevant skills get a small boost
  const countBonus = Math.min(10, Math.round(candidateSkills.length / 5));

  const totalScore = Math.min(100, skillScore + experienceScore + countBonus);

  const explanation: string[] = [];
  if (matched.length > 0) {
    explanation.push(`Matched ${matched.length} skill(s): ${matched.join(', ')}`);
  }
  if (missing.length > 0) {
    explanation.push(`Missing ${missing.length} skill(s): ${missing.join(', ')}`);
  }
  if (experienceScore > 0) {
    explanation.push(`Experience: ${candidateExperience || 0}+ years vs required ${job.experienceMin || 'not specified'}`);
  }
  if (matched.length === 0) {
    explanation.push('No overlapping skills found - consider tailoring your resume.');
  }

  return {
    score: totalScore,
    matchedSkills: matched,
    missingSkills: missing,
    explanation,
  };
}

export function extractJob(url: string, document: Document): JobExtractionResult {
  try {
    new URL(url);
  } catch {
    return {
      supported: false,
      platform: null,
      policy: 'manual_only',
      job: null,
      confidence: 0,
      missingFields: ['valid job URL'],
      reason: 'The current page URL is not valid.',
    };
  }

  const adapter = atsRegistry.getAdapterForUrl(url, document);
  if (!adapter) {
    return {
      supported: false,
      platform: null,
      policy: 'manual_only',
      job: null,
      confidence: 0,
      missingFields: ['supported job platform'],
      reason: 'This site is not supported. You can enter job details manually in the dashboard.',
    };
  }

  const extracted = adapter.extractJob(url, document);
  const formFields = adapter.detectApplicationForm(document);

  const title = extracted?.title || '';
  const company = extracted?.company || '';
  const location = extracted?.location || '';
  const description = extracted?.description || '';

  const { requiredSkills, experienceMin, matchedSkills } = extractSkillsAndExperience(
    `${title} ${description}`,
  );

  const job: ExtractedJob = {
    title,
    company,
    location,
    description,
    url,
    platform: adapter.platform,
    requiredSkills,
    experienceMin,
    matchedSkills,
    missingSkills: [], // Will be filled in when comparing with candidate profile
    matchScore: 0,
  };

  const missingFields = [
    ...(title ? [] : ['title']),
    ...(company ? [] : ['company']),
    ...(location ? [] : ['location']),
    ...(description ? [] : ['description']),
  ];

  const confidence = Math.round(
    ([title, company, location, description].filter(Boolean).length / 4) * 100,
  );

  return {
    supported: true,
    platform: adapter.platform,
    policy: 'manual_only',
    job,
    confidence,
    missingFields,
    detectedFields: formFields,
    canAutoFill: adapter.canAutoFill(),
  };
}