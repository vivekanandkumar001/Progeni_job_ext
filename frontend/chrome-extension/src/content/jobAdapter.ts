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
}

const platforms: Array<[string, string]> = [
  ['naukri.com', 'naukri'],
  ['linkedin.com', 'linkedin'],
  ['indeed.com', 'indeed'],
];

const knownSkills = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust',
  'React', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker',
  'Kubernetes', 'Machine Learning', 'Deep Learning', 'Data Analysis',
  'HTML', 'CSS', 'Git', 'REST API', 'GraphQL', 'Excel', 'Communication',
];

function firstText(document: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) return text.replace(/\s+/g, ' ').slice(0, 500);
  }
  return '';
}

function extractDescription(document: Document): string {
  const selectors = [
    '#jobDescriptionText',
    '[data-testid="jobDescriptionText"]',
    '.description__text',
    '.jobs-description__content',
    '[class*="jobDescription"]',
    '[class*="job-description"]',
    '[class*="description"]',
    'main',
  ];
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text && text.length > 100) return text.replace(/\s+/g, ' ').slice(0, 20000);
  }
  return '';
}

export function extractJob(url: string, document: Document): JobExtractionResult {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
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

  const platform = platforms.find(([domain]) =>
    hostname === domain || hostname.endsWith(`.${domain}`),
  )?.[1];
  if (!platform) {
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

  const title = firstText(document, [
    'h1',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    '[class*="job-title"]',
  ]);
  const company = firstText(document, [
    '[data-testid="inlineHeader-companyName"]',
    '[data-testid="company-name"]',
    '.job-details-jobs-unified-top-card__company-name a',
    '[class*="company-name"]',
    '[class*="companyName"]',
  ]);
  const location = firstText(document, [
    '[data-testid="job-location"]',
    '[class*="job-location"]',
    '[class*="jobLocation"]',
  ]);
  const description = extractDescription(document);
  const searchableText = `${title} ${description}`.toLocaleLowerCase();
  const requiredSkills = knownSkills.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped.toLocaleLowerCase()}([^a-z0-9]|$)`, 'i')
      .test(searchableText);
  });
  const experienceMatch = searchableText.match(
    /(?:minimum|min\.?|at least)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:\s+of)?\s+experience|(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i,
  );
  const experienceMin = experienceMatch
    ? Number(experienceMatch[1] || experienceMatch[2])
    : null;
  const job: ExtractedJob = {
    title,
    company,
    location,
    description,
    url,
    platform,
    requiredSkills,
    experienceMin: Number.isFinite(experienceMin) ? experienceMin : null,
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

  return { supported: true, platform, policy: 'manual_only', job, confidence, missingFields };
}
