import type { ATSAdapter, ExtractedJob, FormField } from './types.js';

export const workdayAdapter: ATSAdapter = {
  platform: 'workday',
  name: 'Workday',

  matches(url: string, document: Document): boolean {
    const isHost = /myworkdayjobs\.com|workday\.com/i.test(url);
    const hasElement = Boolean(document.querySelector('[data-automation-id="jobPostingPage"], [data-automation-id="workdayApp"]'));
    return isHost || hasElement;
  },

  extractJob(url: string, document: Document): ExtractedJob | null {
    const title =
      document.querySelector('[data-automation-id="jobPostingHeader"], h2[data-automation-id="jobTitle"], h1')?.textContent?.trim() ||
      'Workday Opportunity';
    const company =
      document.querySelector('[data-automation-id="companyName"], header img')?.getAttribute('alt') ||
      'Company on Workday';
    const location =
      document.querySelector('[data-automation-id="locations"], [data-automation-id="jobPostingLocation"]')?.textContent?.trim() ||
      'Location not specified';
    const description =
      document.querySelector('[data-automation-id="jobPostingDescription"]')?.textContent?.trim() || '';

    return {
      title,
      company,
      location,
      description: description.slice(0, 15000),
      url,
      platform: 'workday',
      requiredSkills: [],
      experienceMin: null,
    };
  },

  detectApplicationForm(document: Document): FormField[] {
    const fields: FormField[] = [];
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-automation-id*="input"], input');
    for (const input of inputs) {
      const label = input.getAttribute('aria-label') || input.name || input.id;
      if (!label) continue;
      fields.push({
        name: input.name || input.id || 'workday_field',
        label,
        type: input.type === 'file' ? 'file' : input.type === 'email' ? 'email' : 'text',
        required: input.required || input.getAttribute('aria-required') === 'true',
        selector: `[data-automation-id="${input.getAttribute('data-automation-id')}"]`,
      });
    }
    return fields;
  },

  canAutoFill(): boolean {
    // Workday forms use complex shadow DOM / multi-step authentication. Auto-fill is limited to assistive overlay.
    return false;
  },

  requiresManualReview(): boolean {
    return true;
  },
};

