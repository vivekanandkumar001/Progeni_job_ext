import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const ashbyAdapter: ATSAdapter = {
  platform: 'ashby',
  name: 'Ashby',

  matches(url: string, document: Document): boolean {
    const isHost = /jobs\.ashbyhq\.com|ashbyhq\.com/i.test(url);
    const hasElement = Boolean(document.querySelector('[data-ashby-job-posting-id], .ashby-job-posting-container'));
    return isHost || hasElement;
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('h1, [class*="jobPostingHeaderTitle"]')?.textContent?.trim() || 'Untitled Role';
    const company =
      document.querySelector('[class*="organizationName"], header img')?.getAttribute('alt') ||
      'Company on Ashby';
    const location =
      document.querySelector('[class*="location"], [class*="jobPostingHeaderLocation"]')?.textContent?.trim() || 'Remote';
    const description =
      document.querySelector('[class*="description"], [data-testid="job-description"]')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'ashby',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];

    const nameInput = document.querySelector<HTMLInputElement>('input[name*="name" i], input[id*="name" i]');
    if (nameInput) {
      fields.push({
        name: 'name',
        label: 'Full Name',
        type: 'text',
        required: true,
        selector: 'input[name*="name" i], input[id*="name" i]',
        suggestedProfileKey: 'fullName',
      });
    }

    const emailInput = document.querySelector<HTMLInputElement>('input[type="email"], input[name*="email" i]');
    if (emailInput) {
      fields.push({
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        selector: 'input[type="email"]',
        suggestedProfileKey: 'email',
      });
    }

    const phoneInput = document.querySelector<HTMLInputElement>('input[type="tel"], input[name*="phone" i]');
    if (phoneInput) {
      fields.push({
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        required: false,
        selector: 'input[type="tel"]',
        suggestedProfileKey: 'phone',
      });
    }

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (fileInput) {
      fields.push({
        name: 'resume',
        label: 'Resume',
        type: 'file',
        required: true,
        selector: 'input[type="file"]',
      });
    }

    return fields;
  },

  canAutoFill(): boolean {
    return true;
  },

  requiresManualReview(): boolean {
    return true;
  },
};

