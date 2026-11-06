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
}

export interface JobExtractionResult {
  supported: boolean;
  platform: string | null;
  policy: 'manual_only';
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
];

function extractSkillsAndExperience(text: string): {
  requiredSkills: string[];
  experienceMin: number | null;
} {
  const searchableText = text.toLocaleLowerCase();
  const requiredSkills = knownSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped.toLocaleLowerCase()}([^a-z0-9]|$)`, 'i').test(
      searchableText,
    );
  });
  const experienceMatch = searchableText.match(
    /(?:minimum|min\.?|at least)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+of)?\s+experience|(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i,
  );
  const experienceMin = experienceMatch
    ? Number(experienceMatch[1] || experienceMatch[2])
    : null;

  return {
    requiredSkills,
    experienceMin: Number.isFinite(experienceMin) ? experienceMin : null,
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

  const { requiredSkills, experienceMin } = extractSkillsAndExperience(
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
