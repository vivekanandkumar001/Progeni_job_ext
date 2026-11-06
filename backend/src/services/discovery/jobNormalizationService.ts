import { createHash, randomUUID } from 'node:crypto';
import type {
  EmploymentType,
  NormalizedJob,
  RawJobPosting,
  WorkplaceMode,
} from './types.js';
import { normalizeCanonicalUrl } from './urlNormalizer.js';

const SKILL_CATALOG = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Golang', 'Rust', 'PHP', 'Ruby',
  'React', 'Next.js', 'Angular', 'Vue.js', 'Node.js', 'Express', 'FastAPI', 'Django', 'Flask',
  'HTML', 'CSS', 'Tailwind CSS', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'Machine Learning', 'Deep Learning', 'Data Analysis', 'Pandas', 'NumPy', 'scikit-learn',
  'TensorFlow', 'PyTorch', 'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Git',
  'Linux', 'REST API', 'GraphQL', 'Kafka', 'Terraform', 'CI/CD', 'Microservices',
];

export class JobNormalizationService {
  normalize(raw: RawJobPosting, existingJobId?: string): NormalizedJob {
    const id = existingJobId || randomUUID();
    const now = new Date().toISOString();

    const company_name = (raw.companyName || 'Unknown Company').trim();
    const job_title = (raw.title || 'Untitled Role').trim();

    // Clean plain text description
    const rawText = raw.descriptionText || this.stripHtml(raw.descriptionHtml || '');
    const job_description = rawText.trim();

    // Responsibilities extraction (lines with bullet points in description)
    const responsibilities = this.extractResponsibilities(job_description);

    // Skills extraction
    const { required_skills, preferred_skills } = this.extractSkills(
      job_description,
      raw.skillsRaw || [],
    );

    // Experience extraction
    const { experience_min, experience_max } = this.extractExperience(
      job_description,
    );

    // Salary extraction (Strict Zero-Hallucination: null if not stated)
    const { salary_min, salary_max, salary_currency } = this.extractSalary(
      raw.salaryRaw || job_description,
    );

    // Workplace mode & Location
    const location = (raw.locationRaw || '').trim() || null;
    const workplace_mode = this.detectWorkplaceMode(
      raw.workplaceModeRaw,
      location,
      job_description,
    );
    const country = this.detectCountry(location);

    // Employment type
    const employment_type = this.detectEmploymentType(
      raw.employmentTypeRaw,
      job_description,
    );

    // Canonical & Application URLs
    const application_url = (raw.applyUrl || raw.sourceUrl || '').trim();
    const original_source_url = (raw.sourceUrl || raw.applyUrl || '').trim();
    const canonical_url = normalizeCanonicalUrl(application_url || original_source_url);

    // Content Hash (SHA-256)
    const content_hash = this.generateContentHash(company_name, job_title, job_description);

    // Posted at date
    let posted_at: string | null = null;
    if (raw.postedAt) {
      try {
        posted_at = new Date(raw.postedAt).toISOString();
      } catch {
        posted_at = null;
      }
    }

    return {
      id,
      job_id: id,
      external_job_id: raw.externalId ? String(raw.externalId).trim() : null,
      provider: raw.provider,
      company_name,
      job_title,
      job_description,
      responsibilities,
      required_skills,
      preferred_skills,
      experience_min,
      experience_max,
      salary_min,
      salary_max,
      salary_currency,
      employment_type,
      workplace_mode,
      location,
      country,
      application_url,
      original_source_url,
      canonical_url,
      posted_at,
      first_seen_at: now,
      last_seen_at: now,
      last_verified_at: now,
      status: 'active',
      content_hash,
      created_at: now,
      updated_at: now,
    };
  }

  generateContentHash(company: string, title: string, description: string): string {
    const normalizedInput = [
      company.toLowerCase().trim(),
      title.toLowerCase().trim(),
      description.slice(0, 1500).replace(/\s+/g, ' ').toLowerCase().trim(),
    ].join('::');

    return createHash('sha256').update(normalizedInput, 'utf8').digest('hex');
  }

  stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private extractResponsibilities(description: string): string[] {
    const lines = description.split('\n').map((l) => l.trim()).filter(Boolean);
    const bullets = lines.filter(
      (l) => /^[-*•·▪]\s+/.test(l) || /^\d+\.\s+/.test(l),
    );
    return bullets.map((b) => b.replace(/^[-*•·▪\d.]+\s+/, '').trim()).slice(0, 15);
  }

  private extractSkills(
    description: string,
    existingSkills: string[],
  ): { required_skills: string[]; preferred_skills: string[] } {
    const required = new Set<string>(existingSkills.map((s) => s.trim()));
    const preferred = new Set<string>();

    const descLower = description.toLowerCase();

    // Detect technical keywords from catalog
    for (const skill of SKILL_CATALOG) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}(?=$|[^a-zA-Z0-9])`, 'i');
      if (regex.test(descLower)) {
        required.add(skill);
      }
    }

    return {
      required_skills: Array.from(required).slice(0, 25),
      preferred_skills: Array.from(preferred).slice(0, 15),
    };
  }

  private extractExperience(
    description: string,
  ): { experience_min: number | null; experience_max: number | null } {
    // Matches patterns like "5+ years", "3-5 years", "minimum 4 years of experience"
    const expRangeMatch = description.match(
      /\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*\+?\s+years?\b/i,
    );
    if (expRangeMatch) {
      const min = parseInt(expRangeMatch[1], 10);
      const max = parseInt(expRangeMatch[2], 10);
      if (min >= 0 && max <= 30 && min <= max) {
        return { experience_min: min, experience_max: max };
      }
    }

    const expMinMatch = description.match(
      /\b(\d{1,2})\s*\+?\s+years?(?:\s+of)?(?:\s+(?:relevant|professional|software|hands-on))?\s+experience\b/i,
    );
    if (expMinMatch) {
      const min = parseInt(expMinMatch[1], 10);
      if (min >= 0 && min <= 30) {
        return { experience_min: min, experience_max: null };
      }
    }

    return { experience_min: null, experience_max: null };
  }

  private extractSalary(
    text: string,
  ): { salary_min: number | null; salary_max: number | null; salary_currency: string | null } {
    // 1. USD Pattern: "$120,000 - $160,000" or "$140k - $180k"
    const usdRange = text.match(
      /\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:[kK])?\s*(?:-|to)\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:[kK])?/i,
    );
    if (usdRange) {
      let min = parseFloat(usdRange[1].replace(/,/g, ''));
      let max = parseFloat(usdRange[2].replace(/,/g, ''));

      // Handle 'k' multiplier
      if (usdRange[0].toLowerCase().includes('k')) {
        if (min < 1000) min *= 1000;
        if (max < 1000) max *= 1000;
      }

      if (min > 5000 && max > min && max < 2000000) {
        return { salary_min: min, salary_max: max, salary_currency: 'USD' };
      }
    }

    // 2. INR Pattern: "₹25,00,000 - ₹35,00,000" or "25 - 35 LPA"
    const inrRange = text.match(
      /(?:₹|INR|Rs\.?)\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:-|to)\s*(?:₹|INR|Rs\.?)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i,
    );
    if (inrRange) {
      const min = parseFloat(inrRange[1].replace(/,/g, ''));
      const max = parseFloat(inrRange[2].replace(/,/g, ''));
      if (min > 10000 && max > min) {
        return { salary_min: min, salary_max: max, salary_currency: 'INR' };
      }
    }

    const lpaMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*LPA\b/i);
    if (lpaMatch) {
      const min = parseFloat(lpaMatch[1]) * 100000;
      const max = parseFloat(lpaMatch[2]) * 100000;
      return { salary_min: min, salary_max: max, salary_currency: 'INR' };
    }

    // Zero-Hallucination: never fabricate salary
    return { salary_min: null, salary_max: null, salary_currency: null };
  }

  private detectWorkplaceMode(
    rawMode: string | null | undefined,
    location: string | null,
    description: string,
  ): WorkplaceMode {
    const combined = `${rawMode || ''} ${location || ''} ${description.slice(0, 500)}`.toLowerCase();

    if (combined.includes('remote') || combined.includes('anywhere') || combined.includes('work from home')) {
      return 'remote';
    }
    if (combined.includes('hybrid')) {
      return 'hybrid';
    }
    return 'office';
  }

  private detectCountry(location: string | null): string | null {
    if (!location) return null;
    const locLower = location.toLowerCase();
    if (locLower.includes('india') || locLower.includes('bengaluru') || locLower.includes('bangalore') || locLower.includes('mumbai') || locLower.includes('delhi') || locLower.includes('hyderabad') || locLower.includes('pune')) {
      return 'India';
    }
    if (locLower.includes('united states') || locLower.includes('usa') || locLower.includes('san francisco') || locLower.includes('new york') || locLower.includes('austin') || locLower.includes('seattle') || /\b[A-Z]{2}\b/.test(location)) {
      return 'United States';
    }
    if (locLower.includes('united kingdom') || locLower.includes('uk') || locLower.includes('london')) {
      return 'United Kingdom';
    }
    if (locLower.includes('canada') || locLower.includes('toronto') || locLower.includes('vancouver')) {
      return 'Canada';
    }
    return null;
  }

  private detectEmploymentType(
    rawType: string | null | undefined,
    description: string,
  ): EmploymentType {
    const combined = `${rawType || ''} ${description.slice(0, 500)}`.toLowerCase();
    if (combined.includes('part-time') || combined.includes('part time')) return 'part-time';
    if (combined.includes('contract') || combined.includes('contractor') || combined.includes('freelance')) return 'contract';
    if (combined.includes('intern') || combined.includes('internship')) return 'internship';
    return 'full-time';
  }
}

export const jobNormalizationService = new JobNormalizationService();

