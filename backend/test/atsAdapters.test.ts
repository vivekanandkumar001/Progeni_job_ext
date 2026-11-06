import assert from 'node:assert/strict';
import test from 'node:test';
import { greenhouseAdapter } from '../../frontend/chrome-extension/src/content/ats/greenhouseAdapter.js';
import { leverAdapter } from '../../frontend/chrome-extension/src/content/ats/leverAdapter.js';
import { ashbyAdapter } from '../../frontend/chrome-extension/src/content/ats/ashbyAdapter.js';
import { workdayAdapter } from '../../frontend/chrome-extension/src/content/ats/workdayAdapter.js';
import { smartRecruitersAdapter } from '../../frontend/chrome-extension/src/content/ats/smartRecruitersAdapter.js';
import { atsRegistry } from '../../frontend/chrome-extension/src/content/ats/registry.js';

interface MockElement {
  textContent?: string;
  name?: string;
  id?: string;
  type?: string;
  required?: boolean;
  getAttribute(name: string): string | null;
}

function createMockDocument(elements: Record<string, MockElement | MockElement[]>): Document {
  return {
    querySelector(selector: string) {
      const parts = selector.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        const match = elements[trimmed];
        if (Array.isArray(match)) return match[0] ?? null;
        if (match) return match;
      }
      return null;
    },
    querySelectorAll(selector: string) {
      const parts = selector.split(',');
      const results: MockElement[] = [];
      for (const part of parts) {
        const trimmed = part.trim();
        const match = elements[trimmed];
        if (Array.isArray(match)) results.push(...match);
        else if (match) results.push(match);
      }
      return results;
    },
  } as unknown as Document;
}

test('ATS Registry correctly identifies supported platforms by URL', () => {
  const dummyDoc = createMockDocument({});

  const gh = atsRegistry.getAdapterForUrl('https://boards.greenhouse.io/stripe/jobs/12345', dummyDoc);
  assert.equal(gh?.platform, 'greenhouse');

  const lever = atsRegistry.getAdapterForUrl('https://jobs.lever.co/netflix/67890', dummyDoc);
  assert.equal(lever?.platform, 'lever');

  const ashby = atsRegistry.getAdapterForUrl('https://jobs.ashbyhq.com/linear/abcde', dummyDoc);
  assert.equal(ashby?.platform, 'ashby');

  const workday = atsRegistry.getAdapterForUrl('https://target.myworkdayjobs.com/careers/job/1', dummyDoc);
  assert.equal(workday?.platform, 'workday');

  const sr = atsRegistry.getAdapterForUrl('https://jobs.smartrecruiters.com/AcmeCorp/123', dummyDoc);
  assert.equal(sr?.platform, 'smartrecruiters');

  const linkedin = atsRegistry.getAdapterForUrl('https://www.linkedin.com/jobs/view/123456789', dummyDoc);
  assert.equal(linkedin?.platform, 'linkedin');

  const indeed = atsRegistry.getAdapterForUrl('https://www.indeed.com/viewjob?jk=abcdef', dummyDoc);
  assert.equal(indeed?.platform, 'indeed');

  const naukri = atsRegistry.getAdapterForUrl('https://www.naukri.com/job-listings-python-dev-1234', dummyDoc);
  assert.equal(naukri?.platform, 'naukri');

  const unknown = atsRegistry.getAdapterForUrl('https://example.com/careers', dummyDoc);
  assert.equal(unknown, null);
});

test('Greenhouse adapter extracts job details and detects application form fields', () => {
  const mockDoc = createMockDocument({
    '.app-title': { textContent: 'Senior Software Engineer', getAttribute: () => null },
    '.company-name': { textContent: 'Stripe', getAttribute: () => null },
    '.location': { textContent: 'Remote - US', getAttribute: () => null },
    '#content': { textContent: 'We are seeking an engineer to build payment APIs.', getAttribute: () => null },
    '#first_name': { name: 'first_name', id: 'first_name', type: 'text', required: true, getAttribute: () => null },
    '#last_name': { name: 'last_name', id: 'last_name', type: 'text', required: true, getAttribute: () => null },
    '#email': { name: 'email', id: 'email', type: 'email', required: true, getAttribute: () => null },
    '#phone': { name: 'phone', id: 'phone', type: 'tel', required: false, getAttribute: () => null },
    'input[type="file"][name*="resume"]': { name: 'resume', type: 'file', required: true, getAttribute: () => null },
  });

  const job = greenhouseAdapter.extractJob('https://boards.greenhouse.io/stripe/jobs/123', mockDoc);
  assert.equal(job?.title, 'Senior Software Engineer');
  assert.equal(job?.company, 'Stripe');
  assert.equal(job?.location, 'Remote - US');
  assert.equal(job?.platform, 'greenhouse');

  const fields = greenhouseAdapter.detectApplicationForm(mockDoc);
  assert.equal(fields.length, 5);
  const fieldNames = fields.map((f) => f.name);
  assert.ok(fieldNames.includes('first_name'));
  assert.ok(fieldNames.includes('last_name'));
  assert.ok(fieldNames.includes('email'));
  assert.ok(fieldNames.includes('phone'));
  assert.ok(fieldNames.includes('resume'));

  assert.equal(greenhouseAdapter.requiresManualReview(), true);
});

test('Lever adapter extracts job details and detects form fields', () => {
  const mockDoc = createMockDocument({
    '.posting-headline h2': { textContent: 'Product Designer', getAttribute: () => null },
    '.posting-headline .company-name': { textContent: 'Figma', getAttribute: () => null },
    '.posting-categories .location': { textContent: 'San Francisco, CA', getAttribute: () => null },
    '.section-wrapper': { textContent: 'Design high fidelity interfaces.', getAttribute: () => null },
    'input[name="name"]': { name: 'name', type: 'text', required: true, getAttribute: () => null },
    'input[name="email"]': { name: 'email', type: 'email', required: true, getAttribute: () => null },
    'input[name="phone"]': { name: 'phone', type: 'tel', required: false, getAttribute: () => null },
    'input[type="file"][name="resume"]': { name: 'resume', type: 'file', required: true, getAttribute: () => null },
  });

  const job = leverAdapter.extractJob('https://jobs.lever.co/figma/abc', mockDoc);
  assert.equal(job?.title, 'Product Designer');
  assert.equal(job?.company, 'Figma');

  const fields = leverAdapter.detectApplicationForm(mockDoc);
  assert.equal(fields.length, 4);
  assert.equal(leverAdapter.requiresManualReview(), true);
});

test('Workday adapter enforces manual review and refuses blind auto-fill', () => {
  assert.equal(workdayAdapter.canAutoFill(), false);
  assert.equal(workdayAdapter.requiresManualReview(), true);
});
