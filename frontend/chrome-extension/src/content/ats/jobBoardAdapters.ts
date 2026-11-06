import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const linkedInAdapter: ATSAdapter = {
  platform: 'linkedin',
  name: 'LinkedIn',

  matches(url: string): boolean {
    return /linkedin\.com/i.test(url);
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('.job-details-jobs-unified-top-card__job-title, h1.topcard__title, h1')?.textContent?.trim() ||
      'LinkedIn Opportunity';
    const company =
      document.querySelector('.job-details-jobs-unified-top-card__company-name a, .topcard__flavor a, [class*="company-name"]')?.textContent?.trim() ||
      'Company on LinkedIn';
    const location =
      document.querySelector('.job-details-jobs-unified-top-card__bullet, .topcard__flavor--bullet, [class*="job-location"]')?.textContent?.trim() ||
      'Location not specified';
    const description =
      document.querySelector('#job-details, .jobs-description__content, .show-more-less-html__markup')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'linkedin',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];
    const inputs = document.querySelectorAll<HTMLInputElement>('.jobs-easy-apply-modal input, .jobs-easy-apply-content input');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || input.name || input.id;
      if (!label) continue;
      fields.push({
        name: input.name || input.id || 'linkedin_field',
        label,
        type: input.type === 'file' ? 'file' : input.type === 'email' ? 'email' : 'text',
        required: input.required || input.getAttribute('aria-required') === 'true',
        selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
      });
    }
    return fields;
  },

  canAutoFill(): boolean {
    // Easy Apply modal assistance only with explicit user review
    return true;
  },

  requiresManualReview(): boolean {
    return true;
  },
};

export const indeedAdapter: ATSAdapter = {
  platform: 'indeed',
  name: 'Indeed',

  matches(url: string): boolean {
    return /indeed\.com/i.test(url);
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"], h1.jobsearch-JobInfoHeader-title, h1')?.textContent?.trim() ||
      'Indeed Opportunity';
    const company =
      document.querySelector('[data-testid="inlineHeader-companyName"], [data-company-name="true"]')?.textContent?.trim() ||
      'Company on Indeed';
    const location =
      document.querySelector('[data-testid="job-location"], [data-testid="inlineHeader-companyLocation"]')?.textContent?.trim() ||
      'Location not specified';
    const description =
      document.querySelector('#jobDescriptionText, [data-testid="jobDescriptionText"]')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'indeed',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(): FormField[] {
    // Indeed Apply is external redirect or multi-step iframe
    return [];
  },

  canAutoFill(): boolean {
    return false;
  },

  requiresManualReview(): boolean {
    return true;
  },
};

export const naukriAdapter: ATSAdapter = {
  platform: 'naukri',
  name: 'Naukri',

  matches(url: string): boolean {
    return /naukri\.com/i.test(url);
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('.styles_jd-header-title__rZwM1, h1.title, h1')?.textContent?.trim() ||
      'Naukri Opportunity';
    const company =
      document.querySelector('.styles_jd-header-comp-name__MvqAI a, .company-info a')?.textContent?.trim() ||
      'Company on Naukri';
    const location =
      document.querySelector('.styles_jdn-location__header__mB8wL, .location')?.textContent?.trim() ||
      'Location not specified';
    const description =
      document.querySelector('.styles_JDC__dang-inner-html__h0K4t, .job-desc')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'naukri',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(): FormField[] {
    return [];
  },

  canAutoFill(): boolean {
    return false;
  },

  requiresManualReview(): boolean {
    return true;
  },
};

