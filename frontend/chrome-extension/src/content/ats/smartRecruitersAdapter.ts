import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const smartRecruitersAdapter: ATSAdapter = {
  platform: 'smartrecruiters',
  name: 'SmartRecruiters',

  matches(url: string, document: Document): boolean {
    const isHost = /smartrecruiters\.com/i.test(url);
    const hasElement = Boolean(document.querySelector('.st-header, [data-qa="job-description"], .st-apply'));
    return isHost || hasElement;
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('h1.job-title, .st-header h1, h1')?.textContent?.trim() || 'Untitled Role';
    const company =
      document.querySelector('.company-name, .st-header .brand-logo img')?.getAttribute('alt') ||
      'Company on SmartRecruiters';
    const location =
      document.querySelector('.job-location, [itemprop="address"]')?.textContent?.trim() || 'Remote';
    const description =
      document.querySelector('[itemprop="description"], .job-sections, #job-description')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'smartrecruiters',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];

    const firstNameInput = document.querySelector<HTMLInputElement>('input[name*="firstName" i], input[id*="firstName" i]');
    if (firstNameInput) {
      fields.push({
        name: 'firstName',
        label: 'First Name',
        type: 'text',
        required: true,
        selector: 'input[name*="firstName" i]',
        suggestedProfileKey: 'fullName',
      });
    }

    const lastNameInput = document.querySelector<HTMLInputElement>('input[name*="lastName" i], input[id*="lastName" i]');
    if (lastNameInput) {
      fields.push({
        name: 'lastName',
        label: 'Last Name',
        type: 'text',
        required: true,
        selector: 'input[name*="lastName" i]',
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

    const resumeInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (resumeInput) {
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

