import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyQuestion,
  generateGroundedAnswer,
} from '../src/services/answerEngine.js';
import type { CandidateProfile, LocalResume } from '../src/services/localDataStore.js';

const mockProfile: CandidateProfile = {
  fullName: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  phone: '+1-555-0199',
  targetRole: 'Senior Backend Engineer',
  location: 'San Francisco, CA',
  skills: ['Python', 'PostgreSQL', 'Docker', 'FastAPI'],
  experienceYears: 6,
  updatedAt: new Date().toISOString(),
};

const mockResumes: LocalResume[] = [
  {
    id: 'res-1',
    fileName: 'alex_johnson_cv.pdf',
    fileType: 'pdf',
    skills: [
      { skill: 'Python', evidence: 'Architected microservices using Python and FastAPI.' },
      { skill: 'Docker', evidence: 'Containerized production workloads with Docker.' },
    ],
    experienceYears: 6,
    experienceEvidence: '6 years of professional software engineering experience.',
    createdAt: new Date().toISOString(),
  },
];

test('classifyQuestion correctly identifies screening question intent', () => {
  assert.equal(classifyQuestion('What is your full name?'), 'contact_info');
  assert.equal(classifyQuestion('Please provide your email address.'), 'contact_info');
  assert.equal(classifyQuestion('How many years of work experience do you have?'), 'experience_years');
  assert.equal(classifyQuestion('Do you have experience with Python and Docker?'), 'skill_verification');
  assert.equal(classifyQuestion('Will you now or in the future require visa sponsorship?'), 'work_authorization');
  assert.equal(classifyQuestion('What is your desired annual salary compensation?'), 'salary_expectation');
  assert.equal(classifyQuestion('What is your notice period / available start date?'), 'availability');
  assert.equal(classifyQuestion('What university did you attend for your bachelor degree?'), 'education');
  assert.equal(classifyQuestion('Why do you want to join our engineering team?'), 'subjective_behavioral');
  assert.equal(classifyQuestion('Random unknown question?'), 'unknown');
});

test('generateGroundedAnswer extracts exact candidate details with confidence 1.0', () => {
  const nameAnswer = generateGroundedAnswer('What is your full name?', mockProfile, mockResumes);
  assert.equal(nameAnswer.suggestedAnswer, 'Alex Johnson');
  assert.equal(nameAnswer.confidence, 1.0);
  assert.equal(nameAnswer.isGrounded, true);
  assert.equal(nameAnswer.requiresUserReview, false);
  assert.equal(nameAnswer.status, 'ready');

  const emailAnswer = generateGroundedAnswer('Enter your email address', mockProfile, mockResumes);
  assert.equal(emailAnswer.suggestedAnswer, 'alex.johnson@example.com');
  assert.equal(emailAnswer.confidence, 1.0);

  const phoneAnswer = generateGroundedAnswer('Enter your phone number', mockProfile, mockResumes);
  assert.equal(phoneAnswer.suggestedAnswer, '+1-555-0199');
  assert.equal(phoneAnswer.confidence, 1.0);
});

test('generateGroundedAnswer provides experience years grounded in profile', () => {
  const expAnswer = generateGroundedAnswer('Total years of professional experience', mockProfile, mockResumes);
  assert.equal(expAnswer.suggestedAnswer, '6');
  assert.equal(expAnswer.confidence, 0.95);
  assert.equal(expAnswer.isGrounded, true);
});

test('generateGroundedAnswer verifies skill presence with resume evidence', () => {
  const skillAnswer = generateGroundedAnswer('Do you have experience in Python?', mockProfile, mockResumes);
  assert.equal(skillAnswer.suggestedAnswer, 'Yes');
  assert.equal(skillAnswer.confidence, 0.95);
  assert.ok(skillAnswer.evidence?.includes('FastAPI'));
});

test('generateGroundedAnswer strictly refuses to hallucinate visa/authorization answers', () => {
  const authAnswer = generateGroundedAnswer('Do you require visa sponsorship?', mockProfile, mockResumes);
  assert.equal(authAnswer.suggestedAnswer, null);
  assert.equal(authAnswer.confidence, 0);
  assert.equal(authAnswer.requiresUserReview, true);
  assert.equal(authAnswer.status, 'manual_input_required');
  assert.ok(authAnswer.reason?.includes('visa sponsorship'));
});

test('generateGroundedAnswer strictly refuses to fabricate salary expectations', () => {
  const salaryAnswer = generateGroundedAnswer('What is your expected CTC / salary?', mockProfile, mockResumes);
  assert.equal(salaryAnswer.suggestedAnswer, null);
  assert.equal(salaryAnswer.confidence, 0);
  assert.equal(salaryAnswer.requiresUserReview, true);
  assert.equal(salaryAnswer.status, 'manual_input_required');
});

test('generateGroundedAnswer refuses to hallucinate subjective behavioral answers', () => {
  const subjectiveAnswer = generateGroundedAnswer('Why should we hire you?', mockProfile, mockResumes);
  assert.equal(subjectiveAnswer.suggestedAnswer, null);
  assert.equal(subjectiveAnswer.status, 'manual_input_required');
});

test('generateGroundedAnswer handles null profile gracefully', () => {
  const result = generateGroundedAnswer('What is your name?', null, []);
  assert.equal(result.status, 'unsupported');
  assert.equal(result.suggestedAnswer, null);
  assert.equal(result.requiresUserReview, true);
});

