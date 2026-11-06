import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const greenhouseAdapter: ATSAdapter = {
  platform: 'greenhouse',
  name: 'Greenhouse',

  matches(url: string, document: Document): boolean {
    const isHost = /boards\.greenhouse\.io|greenhouse\.io/i.test(url);
    const hasElement = Boolean(document.querySelector('#application_form, #application, form[action*="greenhouse"]'));
    return isHost || hasElement;
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('.app-title, h1.job-name, h1')?.textContent?.trim() || 'Untitled Position';
    const company =
      document.querySelector('.company-name, .logo-container img')?.getAttribute('alt') ||
      document.querySelector('.company-name')?.textContent?.trim() ||
      'Unknown Company';
    const location =
      document.querySelector('.location, .job-location')?.textContent?.trim() || 'Remote';
    const description =
      document.querySelector('#content, .content, #app_body')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'greenhouse',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];

    const firstNameInput = document.querySelector<HTMLInputElement>('#first_name, input[name*="first_name"]');
    if (firstNameInput) {
      fields.push({
        name: 'first_name',
        label: 'First Name',
        type: 'text',
        required: firstNameInput.required || firstNameInput.getAttribute('aria-required') === 'true',
        selector: '#first_name',
        suggestedProfileKey: 'fullName',
      });
    }

    const lastNameInput = document.querySelector<HTMLInputElement>('#last_name, input[name*="last_name"]');
    if (lastNameInput) {
      fields.push({
        name: 'last_name',
        label: 'Last Name',
        type: 'text',
        required: lastNameInput.required || lastNameInput.getAttribute('aria-required') === 'true',
        selector: '#last_name',
        suggestedProfileKey: 'fullName',
      });
    }

    const emailInput = document.querySelector<HTMLInputElement>('#email, input[name*="email"]');
    if (emailInput) {
      fields.push({
        name: 'email',
        label: 'Email',
        type: 'email',
        required: emailInput.required || emailInput.getAttribute('aria-required') === 'true',
        selector: '#email',
        suggestedProfileKey: 'email',
      });
    }

    const phoneInput = document.querySelector<HTMLInputElement>('#phone, input[name*="phone"]');
    if (phoneInput) {
      fields.push({
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        required: phoneInput.required || phoneInput.getAttribute('aria-required') === 'true',
        selector: '#phone',
        suggestedProfileKey: 'phone',
      });
    }

    const resumeInput = document.querySelector<HTMLInputElement>('input[type="file"][name*="resume"]');
    if (resumeInput) {
      fields.push({
        name: 'resume',
        label: 'Resume',
        type: 'file',
        required: true,
        selector: 'input[type="file"][name*="resume"]',
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

