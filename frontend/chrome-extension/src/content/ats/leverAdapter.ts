import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const leverAdapter: ATSAdapter = {
  platform: 'lever',
  name: 'Lever',

  matches(url: string, document: Document): boolean {
    const isHost = /jobs\.lever\.co/i.test(url);
    const hasElement = Boolean(document.querySelector('.posting-headline, form#application-form, .lever-job'));
    return isHost || hasElement;
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('.posting-headline h2, h2.posting-title, h1')?.textContent?.trim() || 'Untitled Role';
    const company =
      document.querySelector('.main-header-logo img')?.getAttribute('alt') ||
      document.querySelector('.posting-headline .company-name')?.textContent?.trim() ||
      'Company on Lever';
    const location =
      document.querySelector('.posting-categories .location, .workplaceTypes')?.textContent?.trim() || 'Remote';
    const description =
      document.querySelector('.section-wrapper, .posting-page')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'lever',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];

    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    if (nameInput) {
      fields.push({
        name: 'name',
        label: 'Full Name',
        type: 'text',
        required: true,
        selector: 'input[name="name"]',
        suggestedProfileKey: 'fullName',
      });
    }

    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    if (emailInput) {
      fields.push({
        name: 'email',
        label: 'Email',
        type: 'email',
        required: true,
        selector: 'input[name="email"]',
        suggestedProfileKey: 'email',
      });
    }

    const phoneInput = document.querySelector<HTMLInputElement>('input[name="phone"]');
    if (phoneInput) {
      fields.push({
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        required: false,
        selector: 'input[name="phone"]',
        suggestedProfileKey: 'phone',
      });
    }

    const resumeInput = document.querySelector<HTMLInputElement>('input[type="file"][name="resume"]');
    if (resumeInput) {
      fields.push({
        name: 'resume',
        label: 'Resume',
        type: 'file',
        required: true,
        selector: 'input[type="file"][name="resume"]',
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

