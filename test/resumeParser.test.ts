import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeResume,
  ResumeParseError,
} from '../src/services/resumeParser.js';

test('analyzeResume throws on empty file buffer', async () => {
  await assert.rejects(
    async () => {
      await analyzeResume('empty.pdf', 'pdf', Buffer.alloc(0));
    },
    (err: unknown) => {
      assert.ok(err instanceof ResumeParseError);
      assert.equal((err as Error).message, 'The selected file is empty.');
      return true;
    },
  );
});

test('analyzeResume throws on corrupted or non-PDF buffer', async () => {
  await assert.rejects(
    async () => {
      await analyzeResume('fake.pdf', 'pdf', Buffer.from('NOT A REAL PDF FILE'));
    },
    (err: unknown) => {
      assert.ok(err instanceof ResumeParseError);
      assert.equal((err as Error).message, 'The file does not appear to be a valid PDF.');
      return true;
    },
  );
});

test('analyzeResume extracts candidate data from plain text file', async () => {
  const resumeText = `
Jane Doe
jane.doe@example.com
+1 (555) 234-5678
Professional Summary
Results-driven software engineer with 5 years of professional experience in building scalable cloud web applications.

Skills
JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, Docker, AWS.

Experience
Senior Full Stack Engineer | Acme Corp (2021 - Present)
- Developed microservices in Node.js and TypeScript.
- Designed database schemas in PostgreSQL and deployed on AWS.
`;

  const buffer = Buffer.from(resumeText, 'utf-8');
  const result = await analyzeResume('resume.txt', 'txt', buffer);

  assert.equal(result.status, 'ready');
  assert.equal(result.detected.fullName, 'Jane Doe');
  assert.equal(result.detected.email, 'jane.doe@example.com');
  assert.equal(result.detected.phone, '+1 (555) 234-5678');
  assert.equal(result.detected.experienceYears, 5);

  const detectedSkills = result.skills.map((s) => s.skill);
  assert.ok(detectedSkills.includes('TypeScript'));
  assert.ok(detectedSkills.includes('Python'));
  assert.ok(detectedSkills.includes('React'));
  assert.ok(detectedSkills.includes('Docker'));
  assert.ok(detectedSkills.includes('PostgreSQL'));
});

