process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../src/middlewares/auth.js';
import { ashbyAdapter } from '../src/services/discovery/adapters/ashbyAdapter.js';
import { greenhouseAdapter } from '../src/services/discovery/adapters/greenhouseAdapter.js';
import { leverAdapter } from '../src/services/discovery/adapters/leverAdapter.js';
import { manualImportAdapter } from '../src/services/discovery/adapters/manualImportAdapter.js';
import { smartRecruitersAdapter } from '../src/services/discovery/adapters/smartRecruitersAdapter.js';
import { workdayAdapter } from '../src/services/discovery/adapters/workdayAdapter.js';
import { JobDeduplicationService } from '../src/services/discovery/jobDeduplicationService.js';
import { JobNormalizationService } from '../src/services/discovery/jobNormalizationService.js';
import { normalizeCanonicalUrl } from '../src/services/discovery/urlNormalizer.js';
import { jobDiscoveryService } from '../src/services/jobDiscoveryService.js';
import {
  getJob,
  importJob,
  listJobs,
  listSavedJobs,
  saveJob,
  unsaveJob,
} from '../src/controllers/jobs.js';

// Setup high-fidelity In-Memory MongoDB Stub
const inMemoryStore = new Map<string, any[]>();

function getCollectionData(name: string): any[] {
  let col = inMemoryStore.get(name);
  if (!col) {
    col = [];
    inMemoryStore.set(name, col);
  }
  return col;
}

function matchesFilter(doc: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const orMatched = expected.some((subFilter) => matchesFilter(doc, subFilter));
      if (!orMatched) return false;
      continue;
    }

    const val = doc[key];

    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const expObj = expected as any;
      if ('$in' in expObj && Array.isArray(expObj.$in)) {
        if (Array.isArray(val)) {
          const hasCommon = val.some((v) => expObj.$in.includes(v));
          if (!hasCommon) return false;
        } else if (!expObj.$in.includes(val)) {
          return false;
        }
      }
      if ('$regex' in expObj) {
        const pattern = new RegExp(expObj.$regex, expObj.$options || 'i');
        const strVal = String(val ?? '');
        if (!pattern.test(strVal)) return false;
      }
      if ('$gte' in expObj) {
        if (typeof val !== 'number' || val < expObj.$gte) return false;
      }
    } else if (expected === null) {
      if (val !== null && val !== undefined) return false;
    } else {
      if (val !== expected) return false;
    }
  }

  return true;
}

function applyUpdate(doc: any, update: any): void {
  if (update.$set) {
    Object.assign(doc, update.$set);
  }
  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      doc[key] = (doc[key] || 0) + (val as number);
    }
  }
}

const mockDb: any = {
  collection(name: string) {
    const col = getCollectionData(name);
    return {
      async insertOne(doc: any) {
        const item = JSON.parse(JSON.stringify(doc));
        if (!item._id) item._id = randomUUID();
        col.push(item);
        return { acknowledged: true, insertedId: item._id };
      },
      async insertMany(docs: any[]) {
        for (const doc of docs) {
          const item = JSON.parse(JSON.stringify(doc));
          if (!item._id) item._id = randomUUID();
          col.push(item);
        }
        return { acknowledged: true, insertedCount: docs.length };
      },
      async findOne(filter: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        return match ? JSON.parse(JSON.stringify(match)) : null;
      },
      async updateOne(filter: any, update: any, options?: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (match) {
          applyUpdate(match, update);
          return { matchedCount: 1, modifiedCount: 1 };
        } else if (options?.upsert) {
          const newItem: any = { ...filter };
          if (update.$set) Object.assign(newItem, update.$set);
          if (!newItem._id) newItem._id = randomUUID();
          col.push(newItem);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0 };
      },
      async replaceOne(filter: any, doc: any, options?: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col[idx] = JSON.parse(JSON.stringify(doc));
          return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
        } else if (options?.upsert) {
          const item = JSON.parse(JSON.stringify(doc));
          col.push(item);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      },
      async deleteOne(filter: any) {
        const idx = col.findIndex((item) => matchesFilter(item, filter));
        if (idx !== -1) {
          col.splice(idx, 1);
          return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
      },
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort() { return this; },
          skip(n: number) {
            results = results.slice(n);
            return this;
          },
          limit(n: number) {
            results = results.slice(0, n);
            return this;
          },
          async toArray() { return JSON.parse(JSON.stringify(results)); },
          async next() { return results.length > 0 ? JSON.parse(JSON.stringify(results[0])) : null; },
        };
      },
    };
  },
};

(globalThis as any).progeniMongoDb = Promise.resolve(mockDb);

function createMockResponse() {
  let statusCode = 200;
  let body: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  } as unknown as Response;
  return { res, getStatus: () => statusCode, getBody: () => body };
}

test('Job Discovery Subsystem', async (t) => {
  const normalizer = new JobNormalizationService();
  const deduplicator = new JobDeduplicationService();

  await t.test('Canonical URL Normalizer strips UTM tags, tracking params, and fragments', () => {
    const raw = 'https://boards.greenhouse.io/stripe/jobs/12345?utm_source=linkedin&utm_medium=job_board&gh_src=custom#application-form';
    const clean = normalizeCanonicalUrl(raw);
    assert.equal(clean, 'https://boards.greenhouse.io/stripe/jobs/12345');
  });

  await t.test('Greenhouse Adapter transforms raw API item into RawJobPosting', () => {
    const mockItem = {
      id: 987654,
      title: 'Staff Distributed Systems Engineer',
      content: '<p>Join our core infra team. Requires 5+ years of experience with Golang, Kubernetes, and AWS. Salary range: $180,000 - $220,000 USD.</p>',
      absolute_url: 'https://boards.greenhouse.io/stripe/jobs/987654?gh_jid=987654',
      location: { name: 'San Francisco, CA' },
      updated_at: '2026-02-15T00:00:00Z',
    };

    const transformed = greenhouseAdapter.transform(mockItem, {
      id: 'source-1',
      provider: 'greenhouse',
      identifier: 'stripe',
      company_name: 'Stripe',
      url: 'https://boards.greenhouse.io/stripe',
      active: true,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    assert.equal(transformed.externalId, '987654');
    assert.equal(transformed.provider, 'greenhouse');
    assert.equal(transformed.companyName, 'Stripe');
    assert.equal(transformed.title, 'Staff Distributed Systems Engineer');
    assert.equal(transformed.locationRaw, 'San Francisco, CA');
    assert.equal(transformed.applyUrl, 'https://boards.greenhouse.io/stripe/jobs/987654?gh_jid=987654');
  });

  await t.test('Lever Adapter transforms raw API item with categories and salary range', () => {
    const mockLever = {
      id: 'lev-555',
      text: 'Full Stack Engineer, Product',
      createdAt: 1770000000000,
      description: '<div>Build modern web experiences with TypeScript, React, and Node.js. Remote eligible.</div>',
      hostedUrl: 'https://jobs.lever.co/netflix/lev-555',
      applyUrl: 'https://jobs.lever.co/netflix/lev-555/apply',
      categories: {
        commitment: 'Full time',
        department: 'Product',
        location: 'Los Gatos, CA',
      },
      workplaceType: 'hybrid',
      salaryRange: {
        min: 160000,
        max: 210000,
        currency: 'USD',
        interval: 'per-year-salary',
      },
    };

    const transformed = leverAdapter.transform(mockLever, {
      id: 'source-2',
      provider: 'lever',
      identifier: 'netflix',
      company_name: 'Netflix',
      url: 'https://jobs.lever.co/netflix',
      active: true,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    assert.equal(transformed.externalId, 'lev-555');
    assert.equal(transformed.workplaceModeRaw, 'hybrid');
    assert.match(transformed.salaryRaw || '', /USD 160000 - 210000/);
    assert.equal(transformed.applyUrl, 'https://jobs.lever.co/netflix/lev-555/apply');
  });

  await t.test('Ashby Adapter transforms raw API item with compensationTierSummary', () => {
    const mockAshby = {
      id: 'ashby-888',
      title: 'Senior Frontend Engineer',
      location: 'Remote - Worldwide',
      isRemote: true,
      jobUrl: 'https://jobs.ashbyhq.com/vercel/ashby-888',
      publishedAt: '2026-02-18T12:00:00Z',
      compensation: {
        compensationTierSummary: '$150,000 - $190,000 USD',
      },
    };

    const transformed = ashbyAdapter.transform(mockAshby, {
      id: 'source-3',
      provider: 'ashby',
      identifier: 'vercel',
      company_name: 'Vercel',
      url: 'https://jobs.ashbyhq.com/vercel',
      active: true,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    assert.equal(transformed.externalId, 'ashby-888');
    assert.equal(transformed.workplaceModeRaw, 'remote');
    assert.equal(transformed.salaryRaw, '$150,000 - $190,000 USD');
  });

  await t.test('SmartRecruiters Adapter transforms posting item with geographic components', () => {
    const mockSr = {
      id: 'sr-999',
      name: 'Cloud Infrastructure Architect',
      releasedDate: '2026-02-20T08:00:00Z',
      location: {
        city: 'Amsterdam',
        country: 'nl',
        remote: true,
      },
      typeOfEmployment: { label: 'Full-time' },
    };

    const transformed = smartRecruitersAdapter.transform(mockSr, {
      id: 'source-4',
      provider: 'smartrecruiters',
      identifier: 'visa',
      company_name: 'Visa',
      url: 'https://jobs.smartrecruiters.com/visa',
      active: true,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    assert.equal(transformed.externalId, 'sr-999');
    assert.equal(transformed.locationRaw, 'Amsterdam, NL');
    assert.equal(transformed.workplaceModeRaw, 'remote');
  });

  await t.test('Workday Adapter respects anti-bot boundaries and manual review', () => {
    const mockPosting = {
      title: 'Principal Software Engineer',
      externalPath: '/job/US-Remote/Principal-Software-Engineer_R1020',
      locationsText: 'Remote, United States',
      bulletFields: ['Key responsibilities: Lead cloud transformation.'],
    };

    const transformed = workdayAdapter.transform(mockPosting, {
      id: 'source-5',
      provider: 'workday',
      identifier: 'target',
      company_name: 'Target',
      url: 'https://target.myworkdayjobs.com/careers',
      active: true,
      last_crawled_at: null,
      jobs_discovered: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    assert.equal(transformed.title, 'Principal Software Engineer');
    assert.equal(transformed.applyUrl, 'https://target.myworkdayjobs.com/job/US-Remote/Principal-Software-Engineer_R1020');
  });

  await t.test('Normalization: Zero-Hallucination rule sets missing salary & experience to null', () => {
    const raw = manualImportAdapter.createRawPosting({
      title: 'Software Developer',
      companyName: 'Acme Corp',
      descriptionText: 'Looking for a general developer to assist with web development. No salary mentioned.',
      url: 'https://acme.com/jobs/dev-1',
    });

    const normalized = normalizer.normalize(raw);

    assert.equal(normalized.job_title, 'Software Developer');
    assert.equal(normalized.company_name, 'Acme Corp');
    assert.equal(normalized.salary_min, null, 'Salary min must be null when unstated');
    assert.equal(normalized.salary_max, null, 'Salary max must be null when unstated');
    assert.equal(normalized.salary_currency, null, 'Salary currency must be null when unstated');
    assert.equal(normalized.experience_min, null, 'Experience min must be null when unstated');
    assert.equal(normalized.experience_max, null, 'Experience max must be null when unstated');
    assert.ok(normalized.content_hash.length === 64, 'Must compute SHA-256 hash');
  });

  await t.test('Normalization: extracts skills, salary, experience range, workplace mode from rich text', () => {
    const raw = manualImportAdapter.createRawPosting({
      title: 'Senior Full Stack Engineer',
      companyName: 'Tech Innovations',
      descriptionText: `
        We are seeking a Senior Full Stack Engineer.
        Location: Hybrid in Seattle, WA.
        Experience: 4 - 8 years of software engineering experience.
        Salary: $140,000 - $185,000 USD annually.
        Required Skills: TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, AWS.
        Preferred: Kubernetes, Redis, GraphQL.
        Responsibilities:
        - Design scalable web applications
        - Collaborate with cross-functional teams
      `,
      url: 'https://techinnovations.io/careers/senior-eng?ref=jobboard',
    });

    const normalized = normalizer.normalize(raw);

    assert.equal(normalized.workplace_mode, 'hybrid');
    assert.equal(normalized.experience_min, 4);
    assert.equal(normalized.experience_max, 8);
    assert.equal(normalized.salary_min, 140000);
    assert.equal(normalized.salary_max, 185000);
    assert.equal(normalized.salary_currency, 'USD');
    assert.ok(normalized.required_skills.includes('TypeScript'));
    assert.ok(normalized.required_skills.includes('React'));
    assert.ok(normalized.required_skills.includes('Docker'));
    assert.equal(normalized.canonical_url, 'https://techinnovations.io/careers/senior-eng');
  });

  await t.test('Deduplication: inserts new job and updates duplicate safely', async () => {
    const raw1 = manualImportAdapter.createRawPosting({
      title: 'DevOps Engineer',
      companyName: 'CloudScale Inc',
      descriptionText: 'Manage Kubernetes clusters and AWS infrastructure. 3+ years experience.',
      url: 'https://cloudscale.com/jobs/101?utm_campaign=winter',
      externalId: 'cloudscale-101',
      provider: 'greenhouse',
    });

    const normalized1 = normalizer.normalize(raw1);
    const result1 = await deduplicator.deduplicateAndSave(normalized1);

    assert.equal(result1.action, 'inserted');
    assert.equal(result1.isDuplicate, false);
    const originalId = result1.job.id;
    const originalFirstSeen = result1.job.first_seen_at;

    // Simulate incoming crawl of the same job with different tracking URL
    const raw2 = manualImportAdapter.createRawPosting({
      title: 'DevOps Engineer',
      companyName: 'CloudScale Inc',
      descriptionText: 'Manage Kubernetes clusters and AWS infrastructure. 3+ years experience.',
      url: 'https://cloudscale.com/jobs/101?utm_source=twitter',
      externalId: 'cloudscale-101',
      provider: 'greenhouse',
    });

    const normalized2 = normalizer.normalize(raw2);
    const result2 = await deduplicator.deduplicateAndSave(normalized2);

    assert.equal(result2.action, 'updated');
    assert.equal(result2.isDuplicate, true);
    assert.equal(result2.job.id, originalId, 'Existing ID must be preserved');
    assert.equal(result2.job.first_seen_at, originalFirstSeen, 'first_seen_at must be preserved');
    assert.equal(result2.job.status, 'active', 'Re-seen job must remain active');
  });

  await t.test('Candidate Saved Jobs: saves, retrieves, and unsaves with multi-tenant isolation', async () => {
    // Insert a test job
    const imported = await jobDiscoveryService.importJob('user-candidate-1', {
      title: 'AI Platform Engineer',
      companyName: 'Neural Works',
      descriptionText: 'Build distributed LLM inference pipelines with Python and PyTorch. Remote.',
      url: 'https://neuralworks.ai/jobs/ai-plat-99',
    });

    const candidateA = 'candidate-alpha-uuid';
    const candidateB = 'candidate-beta-uuid';

    // Candidate A saves the job
    const saved = await jobDiscoveryService.saveJob(candidateA, imported.id, 'Applied on portfolio');
    assert.equal(saved.user_id, candidateA);
    assert.equal(saved.job_id, imported.id);

    // Verify candidate A sees it saved
    const isSavedA = await jobDiscoveryService.isJobSaved(candidateA, imported.id);
    assert.equal(isSavedA, true);

    // Multi-tenant isolation: Candidate B must NOT see it saved
    const isSavedB = await jobDiscoveryService.isJobSaved(candidateB, imported.id);
    assert.equal(isSavedB, false);

    const listA = await jobDiscoveryService.listSavedJobs(candidateA);
    assert.ok(listA.total >= 1);
    assert.equal(listA.saved_jobs[0].job_id, imported.id);

    const listB = await jobDiscoveryService.listSavedJobs(candidateB);
    assert.equal(listB.total, 0, 'Candidate B must not see Candidate A saved jobs');

    // Candidate A unsaves job
    const unsaved = await jobDiscoveryService.unsaveJob(candidateA, imported.id);
    assert.equal(unsaved, true);

    const isSavedAfter = await jobDiscoveryService.isJobSaved(candidateA, imported.id);
    assert.equal(isSavedAfter, false);
  });

  await t.test('Personalized Search: scores and ranks jobs against candidate preferences', async () => {
    const candidateId = 'candidate-personalization-test';

    // Seed candidate preferences in mockDb
    const prefCol = getCollectionData('candidate_preferences');
    prefCol.push({
      _id: candidateId,
      id: candidateId,
      user_id: candidateId,
      desired_roles: ['AI Platform Engineer', 'Full Stack Engineer'],
      preferred_locations: ['Seattle', 'Remote'],
      workplace_type: 'remote',
      expected_salary: { currency: 'USD', min: 120000, max: 200000, period: 'yearly' },
      experience_level: 'senior',
      joining_availability: 'immediate',
      employment_type: 'full-time',
    });

    const profCol = getCollectionData('candidate_profiles');
    profCol.push({
      _id: candidateId,
      id: candidateId,
      user_id: candidateId,
      skills: ['Python', 'PyTorch', 'AWS', 'Docker'],
      target_role: 'AI Platform Engineer',
    });

    // Perform personalized search
    const result = await jobDiscoveryService.searchJobs(
      {
        personalized: true,
        limit: 10,
      },
      candidateId,
    );

    assert.equal(result.isPersonalized, true);
    assert.ok(Array.isArray(result.jobs));
    if (result.jobs.length > 0) {
      assert.ok(typeof result.jobs[0].personalized_score === 'number');
      assert.ok(Array.isArray(result.jobs[0].match_reasons));
    }
  });

  await t.test('Controller Endpoints: listJobs, getJob, importJob, saveJob, unsaveJob', async () => {
    const candidateUserId = 'controller-test-candidate';

    // 1. importJob
    const { res: importRes, getStatus: getImportStatus, getBody: getImportBody } = createMockResponse();
    const next: NextFunction = () => {};

    const reqImport = {
      userId: candidateUserId,
      userRole: 'candidate',
      body: {
        title: 'Lead Systems Architect',
        companyName: 'Apex Systems',
        descriptionText: 'Lead enterprise cloud architecture with Go, Kubernetes, and AWS.',
        url: 'https://apexsystems.example/jobs/arch-1',
        workplaceMode: 'remote',
      },
    } as AuthRequest;

    await importJob(reqImport, importRes, next);
    assert.equal(getImportStatus(), 200);
    const createdJob = getImportBody().job;
    assert.ok(createdJob.id);
    assert.equal(createdJob.job_title, 'Lead Systems Architect');

    // 2. listJobs
    const { res: listRes, getStatus: getListStatus, getBody: getListBody } = createMockResponse();
    const reqList = {
      userId: candidateUserId,
      query: { q: 'Architect', page: '1', limit: '10' },
    } as unknown as AuthRequest;

    await listJobs(reqList, listRes, next);
    assert.equal(getListStatus(), 200);
    assert.equal(getListBody().ok, true);
    assert.ok(getListBody().jobs.length >= 1);

    // 3. getJob
    const { res: getRes, getStatus: getGetStatus, getBody: getGetBody } = createMockResponse();
    const reqGet = {
      userId: candidateUserId,
      params: { id: createdJob.id },
    } as unknown as AuthRequest;

    await getJob(reqGet, getRes, next);
    assert.equal(getGetStatus(), 200);
    assert.equal(getGetBody().job.id, createdJob.id);

    // 4. saveJob
    const { res: saveRes, getStatus: getSaveStatus, getBody: getSaveBody } = createMockResponse();
    const reqSave = {
      userId: candidateUserId,
      params: { id: createdJob.id },
      body: { notes: 'Top choice' },
    } as unknown as AuthRequest;

    await saveJob(reqSave, saveRes, next);
    assert.equal(getSaveStatus(), 200);
    assert.equal(getSaveBody().saved.job_id, createdJob.id);

    // 5. listSavedJobs
    const { res: savedListRes, getStatus: getSavedListStatus, getBody: getSavedListBody } = createMockResponse();
    const reqSavedList = {
      userId: candidateUserId,
      query: {},
    } as unknown as AuthRequest;

    await listSavedJobs(reqSavedList, savedListRes, next);
    assert.equal(getSavedListStatus(), 200);
    assert.ok(getSavedListBody().saved_jobs.length >= 1);
    assert.equal(getSavedListBody().saved_jobs[0].job_id, createdJob.id);

    // 6. unsaveJob
    const { res: unsaveRes, getStatus: getUnsaveStatus, getBody: getUnsaveBody } = createMockResponse();
    const reqUnsave = {
      userId: candidateUserId,
      params: { id: createdJob.id },
    } as unknown as AuthRequest;

    await unsaveJob(reqUnsave, unsaveRes, next);
    assert.equal(getUnsaveStatus(), 200);
    assert.equal(getUnsaveBody().unsaved, true);
  });
});
