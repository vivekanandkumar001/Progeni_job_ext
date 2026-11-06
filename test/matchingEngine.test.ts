import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMatchScore, checkHardEligibility } from '../src/services/matchingEngine.js';

test('calculateMatchScore returns 0 and explanation when factors are empty', () => {
  const result = calculateMatchScore({});
  assert.equal(result.score, 0);
  assert.deepEqual(result.missingEvidence, []);
  assert.ok(result.explanation.includes('No numeric scoring factors were provided.'));
});

test('calculateMatchScore averages factors and clamps between 0 and 100', () => {
  const result = calculateMatchScore({
    skills: 80,
    experience: 100,
    role: 60,
  });
  assert.equal(result.score, 80); // (80 + 100 + 60) / 3 = 80
  assert.equal(result.missingEvidence.length, 0);
  assert.equal(result.explanation.length, 3);
});

test('calculateMatchScore flags non-numeric factors as missingEvidence', () => {
  const result = calculateMatchScore({
    skills: 90,
    experience: 'unknown' as unknown as number,
    salary: null as unknown as number,
  });
  assert.equal(result.score, 90);
  assert.deepEqual(result.missingEvidence.sort(), ['experience', 'salary'].sort());
});

test('checkHardEligibility passes when all mandatory skills and experience are met', () => {
  const candidate = {
    skills: ['Python', 'TypeScript', 'Docker'],
    experienceYears: 4,
  };
  const job = {
    mandatorySkills: ['Python', 'TypeScript'],
    experienceMin: 3,
  };
  const result = checkHardEligibility(candidate, job);
  assert.equal(result.eligible, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.unknowns.length, 0);
  assert.ok(result.evidence.includes('All mandatory skills are present.'));
  assert.ok(result.evidence.includes('Candidate meets the minimum experience requirement.'));
});

test('checkHardEligibility flags blockers when mandatory skills or experience are lacking', () => {
  const candidate = {
    skills: ['Python'],
    experienceYears: 2,
  };
  const job = {
    mandatorySkills: ['Python', 'Kubernetes', 'Go'],
    experienceMin: 5,
  };
  const result = checkHardEligibility(candidate, job);
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.some((b) => b.includes('Kubernetes, Go')));
  assert.ok(result.blockers.some((b) => b.includes('5 years')));
});

test('checkHardEligibility flags unknowns when candidate experience or skills are missing', () => {
  const candidate = {};
  const job = {
    mandatorySkills: ['React'],
    experienceMin: 2,
  };
  const result = checkHardEligibility(candidate, job);
  assert.equal(result.eligible, false);
  assert.ok(result.unknowns.includes('Candidate skills were not provided.'));
  assert.ok(result.unknowns.includes('Candidate experience is not known.'));
});

