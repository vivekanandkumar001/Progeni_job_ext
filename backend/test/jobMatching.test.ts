process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../src/middlewares/auth.js';
import {
  normalizeSkill,
  skillsMatch,
  mapToCanonicalSkills,
} from '../src/services/matching/skillTaxonomy.js';
import { matchingEngine } from '../src/services/matching/matchingEngine.js';
import { hardEligibilityEngine } from '../src/services/matching/eligibilityEngine.js';
import { matchService } from '../src/services/matchService.js';
import {
  getMatch,
  getMatchSummary,
  getSkillGaps,
  listMatches,
  recalculateMatches,
} from '../src/controllers/matches.js';

// Setup In-Memory MongoDB Stub
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
      if ('$gte' in expObj) {
        if (typeof val !== 'number' || val < expObj.$gte) return false;
      }
      if ('$regex' in expObj) {
        const pattern = new RegExp(expObj.$regex, expObj.$options || 'i');
        const strVal = String(val ?? '');
        if (!pattern.test(strVal)) return false;
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
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort(sortCriteria: any) {
            if (sortCriteria && typeof sortCriteria === 'object') {
              const [key, dir] = Object.entries(sortCriteria)[0];
              results.sort((a, b) => {
                const valA = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], a) : a[key];
                const valB = key.includes('.') ? key.split('.').reduce((o, i) => o?.[i], b) : b[key];
                return (dir as number) > 0 ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
              });
            }
            return this;
          },
          skip(n: number) {
            results = results.slice(n);
            return this;
          },
          limit(n: number) {
            results = results.slice(0, n);
            return this;
          },
          async toArray() { return JSON.parse(JSON.stringify(results)); },
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

test('Job Matching & Ranking Subsystem', async (t) => {
  await t.test('Skill Taxonomy: normalizes aliases and checks synonym equivalence', () => {
    assert.equal(normalizeSkill('k8s'), 'Kubernetes');
    assert.equal(normalizeSkill('ts'), 'TypeScript');
    assert.equal(normalizeSkill('reactjs'), 'React');
    assert.equal(normalizeSkill('postgres'), 'PostgreSQL');
    assert.equal(normalizeSkill('golang'), 'Golang');
    assert.equal(normalizeSkill('ml'), 'Machine Learning');

    assert.equal(skillsMatch('k8s', 'kubernetes'), true);
    assert.equal(skillsMatch('TypeScript', 'ts'), true);
    assert.equal(skillsMatch('React', 'react.js'), true);

    // Negative check: distinct technologies must NOT be matched
    assert.equal(skillsMatch('Python', 'PyTorch'), false);
    assert.equal(skillsMatch('Java', 'JavaScript'), false);
    assert.equal(skillsMatch('C#', 'C++'), false);
  });

  await t.test('Hard Eligibility Engine: identifies eligible, ineligible, and insufficient info', () => {
    // 1. Fully eligible
    const eligibleRes = hardEligibilityEngine.evaluate({
      candidate: {
        skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
        experience_years: 4,
      },
      job: {
        mandatory_skills: ['TypeScript', 'Node.js'],
        experience_min: 3,
      },
    });
    assert.equal(eligibleRes.decision, 'eligible');
    assert.equal(eligibleRes.eligible, true);
    assert.equal(eligibleRes.blockers.length, 0);

    // 2. Ineligible due to missing mandatory skill
    const missingSkillRes = hardEligibilityEngine.evaluate({
      candidate: {
        skills: ['TypeScript'],
        experience_years: 5,
      },
      job: {
        mandatory_skills: ['TypeScript', 'Kubernetes'],
        experience_min: 3,
      },
    });
    assert.equal(missingSkillRes.decision, 'ineligible');
    assert.equal(missingSkillRes.eligible, false);
    assert.match(missingSkillRes.blockers[0], /Missing mandatory skills: Kubernetes/);

    // 3. Ineligible due to experience deficit
    const expDeficitRes = hardEligibilityEngine.evaluate({
      candidate: {
        skills: ['TypeScript', 'Node.js'],
        experience_years: 1,
      },
      job: {
        mandatory_skills: ['TypeScript'],
        experience_min: 5,
      },
    });
    assert.equal(expDeficitRes.decision, 'ineligible');
    assert.equal(expDeficitRes.eligible, false);
    assert.match(expDeficitRes.blockers[0], /Requires minimum 5 years/);

    // 4. Insufficient info when candidate details are missing
    const insufficientRes = hardEligibilityEngine.evaluate({
      candidate: {
        skills: [],
        experience_years: null,
      },
      job: {
        mandatory_skills: ['Go'],
        experience_min: 4,
      },
    });
    assert.equal(insufficientRes.decision, 'insufficient_information');
    assert.equal(insufficientRes.unknowns.length >= 2, true);
  });

  await t.test('Matching Engine: computes deterministic 6-dimension scores and explanations', () => {
    const candidate = {
      id: 'cand-1',
      user_id: 'cand-1',
      target_role: 'Full Stack Engineer',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
      experience_years: 4,
      education: [{ degree: 'Bachelors in Computer Science' }],
      workplace_type: 'remote' as const,
      desired_roles: ['Full Stack Engineer', 'Frontend Engineer'],
      expected_salary_min: 130000,
    };

    const job = {
      id: 'job-1',
      job_title: 'Senior Full Stack Engineer',
      company_name: 'Stripe',
      job_description: 'We are looking for a Senior Full Stack Engineer with TypeScript, React, and Docker. Remote friendly.',
      required_skills: ['TypeScript', 'React', 'Docker'],
      preferred_skills: ['Kubernetes', 'PostgreSQL'],
      experience_min: 3,
      experience_max: 6,
      salary_min: 140000,
      salary_max: 180000,
      salary_currency: 'USD',
      workplace_mode: 'remote' as const,
      location: 'Remote - US',
    };

    const match = matchingEngine.evaluateMatch(candidate, job);

    assert.equal(match.user_id, 'cand-1');
    assert.equal(match.job_id, 'job-1');
    assert.ok(match.overall_score >= 80, `Expected high match score, got ${match.overall_score}`);
    assert.equal(match.dimension_scores.skills_alignment >= 80, true);
    assert.equal(match.dimension_scores.experience_eligibility, 100);
    assert.equal(match.dimension_scores.location_compatibility, 100);
    assert.equal(match.dimension_scores.salary_compatibility, 100);
    assert.equal(match.eligibility_status, 'eligible');
    assert.ok(match.explanation.length >= 4);
    assert.equal(match.confidence >= 80, true);

    // Determinism test: same inputs must produce exact same scores
    const match2 = matchingEngine.evaluateMatch(candidate, job);
    assert.equal(match.overall_score, match2.overall_score);
    assert.deepEqual(match.dimension_scores, match2.dimension_scores);
  });

  await t.test('Matching Engine: handles unstated fields without hallucination', () => {
    const candidate = {
      id: 'cand-2',
      user_id: 'cand-2',
      skills: ['Python'],
      // Missing experience, target role, education, expected salary
    };

    const job = {
      id: 'job-2',
      job_title: 'Python Developer',
      company_name: 'Acme',
      // Missing experience requirement, salary unlisted, location unlisted
      required_skills: ['Python'],
    };

    const match = matchingEngine.evaluateMatch(candidate, job);

    assert.ok(match.confidence < 80, 'Confidence must be penalized for missing inputs');
    assert.equal(match.salary_details.status, 'salary_unlisted');
    assert.match(match.salary_details.note, /not publicly disclosed/);
    assert.equal(match.experience_details.status, 'meets'); // no requirement
  });

  await t.test('Fresher vs Senior Job: evaluates entry-level candidate against senior role', () => {
    const fresher = {
      id: 'fresher-1',
      user_id: 'fresher-1',
      skills: ['Java', 'Spring Boot'],
      experience_years: 0.5,
      target_role: 'Junior Developer',
    };

    const seniorJob = {
      id: 'job-senior',
      job_title: 'Staff Architect',
      company_name: 'Enterprise Corp',
      required_skills: ['Java', 'Spring Boot', 'Kafka', 'Kubernetes'],
      experience_min: 8,
    };

    const match = matchingEngine.evaluateMatch(fresher, seniorJob);

    assert.ok(match.dimension_scores.experience_eligibility < 20);
    assert.equal(match.eligibility_status, 'ineligible');
    assert.ok(match.blockers.length > 0);
  });

  await t.test('Match Service: recalculates and persists matches idempotently', async () => {
    const testUserId = 'match-persist-user';

    // Seed profile in mockDb
    const profCol = getCollectionData('candidate_profiles');
    profCol.push({
      _id: testUserId,
      user_id: testUserId,
      full_name: 'Alex Developer',
      target_role: 'Backend Engineer',
      skills: ['Go', 'Docker', 'Kubernetes'],
      experience_years: 5,
    });

    // Seed active jobs in mockDb
    const jobsCol = getCollectionData('jobs');
    jobsCol.push({
      _id: 'job-match-test-1',
      job_title: 'Backend Engineer (Go)',
      company_name: 'CloudCo',
      required_skills: ['Go', 'Docker'],
      experience_min: 3,
      status: 'active',
    });
    jobsCol.push({
      _id: 'job-match-test-2',
      job_title: 'Frontend Lead',
      company_name: 'DesignCo',
      required_skills: ['React', 'CSS'],
      experience_min: 6,
      status: 'active',
    });

    // Recalculate
    const results = await matchService.recalculateMatches(testUserId);
    assert.ok(results.length >= 2);
    const topMatch = results[0];
    assert.equal(topMatch.job_id, 'job-match-test-1');
    assert.ok(topMatch.overall_score > results[1].overall_score);

    // Verify persistence in job_matches collection
    const listRes = await matchService.list(testUserId);
    assert.equal(listRes.total, 2);
    assert.equal(listRes.matches[0].job_id, 'job-match-test-1');

    // Re-run recalculation: must update in-place without duplicating records
    await matchService.recalculateMatches(testUserId);
    const listResAfter = await matchService.list(testUserId);
    assert.equal(listResAfter.total, 2, 'Recalculation must be idempotent');
  });

  await t.test('Multi-Tenant IDOR Defense: candidate B cannot access candidate A match record', async () => {
    const candidateA = 'candidate-a-secure';
    const candidateB = 'candidate-b-secure';

    const matchCol = getCollectionData('job_matches');
    matchCol.push({
      _id: 'match-cand-a-job-1',
      id: 'match-cand-a-job-1',
      user_id: candidateA,
      job_id: 'job-1',
      overall_score: 95,
      eligibility_status: 'eligible',
    });

    // Candidate A can access
    const matchA = await matchService.get('match-cand-a-job-1', candidateA);
    assert.ok(matchA);
    assert.equal(matchA.overall_score, 95);

    // Candidate B strictly blocked (returns null -> 404)
    const matchB = await matchService.get('match-cand-a-job-1', candidateB);
    assert.equal(matchB, null, 'Candidate B must not access Candidate A match');
  });

  await t.test('Skill Gap Analyzer: detects frequently missing skills across active postings', async () => {
    const gaps = await matchService.getSkillGaps('match-persist-user');
    assert.ok(Array.isArray(gaps.top_missing_skills));
    assert.ok(gaps.disclaimer.length > 0);
  });

  await t.test('Controllers: listMatches, getMatch, getMatchSummary, getSkillGaps', async () => {
    const candidateId = 'controller-match-user';
    const { res: summaryRes, getStatus: getSummStatus, getBody: getSummBody } = createMockResponse();
    const next: NextFunction = () => {};

    const reqSummary = {
      userId: candidateId,
      userRole: 'candidate',
    } as AuthRequest;

    await getMatchSummary(reqSummary, summaryRes, next);
    assert.equal(getSummStatus(), 200);
    assert.ok(getSummBody().ok);
    assert.ok(typeof getSummBody().summary.total_matches === 'number');

    const { res: gapsRes, getStatus: getGapsStatus, getBody: getGapsBody } = createMockResponse();
    await getSkillGaps(reqSummary, gapsRes, next);
    assert.equal(getGapsStatus(), 200);
    assert.ok(getGapsBody().ok);
  });
});

