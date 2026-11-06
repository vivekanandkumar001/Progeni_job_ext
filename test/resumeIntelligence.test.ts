process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import type { AuthRequest } from '../src/middlewares/auth.js';
import {
  getMasterResumeHandler,
  listResumesHandler,
  getResumeHandler,
  createResumeHandler,
  updateResumeHandler,
  publishResumeHandler,
  restoreResumeHandler,
  duplicateResumeHandler,
  deleteResumeHandler,
  diagnoseATSHandler,
  compareJDHandler,
  generateTargetedHandler,
  listClaimsHandler,
  createClaimHandler,
  confirmClaimHandler,
  deleteClaimHandler,
  exportPdfHandler,
  exportDocxHandler,
} from '../src/controllers/resumeStudio.js';
import { resumeStudioService } from '../src/services/resumeStudioService.js';
import { truthEngineService } from '../src/services/truthEngineService.js';
import { resumeAnalyzerService } from '../src/services/resumeAnalyzerService.js';
import { targetedResumeService } from '../src/services/targetedResumeService.js';
import { resumeExportService } from '../src/services/resumeExportService.js';

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
  for (const [key, expected] of Object.entries(filter)) {
    if (expected && typeof expected === 'object' && '$gt' in expected) {
      if (!(doc[key] > (expected as any).$gt)) return false;
    } else if (expected && typeof expected === 'object' && '$lt' in expected) {
      if (!(doc[key] < (expected as any).$lt)) return false;
    } else if (expected && typeof expected === 'object' && '$ne' in expected) {
      if (doc[key] === (expected as any).$ne) return false;
    } else if (expected === null) {
      if (doc[key] !== null && doc[key] !== undefined) return false;
    } else {
      if (doc[key] !== expected) return false;
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
  if (update.$push) {
    for (const [key, val] of Object.entries(update.$push)) {
      if (!Array.isArray(doc[key])) doc[key] = [];
      if (val && typeof val === 'object' && '$each' in (val as any)) {
        doc[key].push(...(val as any).$each);
      } else {
        doc[key].push(val);
      }
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
      async findOne(filter: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        return match ? JSON.parse(JSON.stringify(match)) : null;
      },
      async updateOne(filter: any, update: any) {
        const match = col.find((item) => matchesFilter(item, filter));
        if (!match) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(match, update);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async updateMany(filter: any, update: any) {
        let count = 0;
        for (const item of col) {
          if (matchesFilter(item, filter)) {
            applyUpdate(item, update);
            count++;
          }
        }
        return { matchedCount: count, modifiedCount: count };
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
      async deleteMany(filter: any) {
        const initial = col.length;
        const remaining = col.filter((item) => !matchesFilter(item, filter));
        inMemoryStore.set(name, remaining);
        return { deletedCount: initial - remaining.length };
      },
      async countDocuments(filter: any = {}) {
        return col.filter((item) => matchesFilter(item, filter)).length;
      },
      find(filter: any = {}) {
        let results = col.filter((item) => matchesFilter(item, filter));
        return {
          sort() { return this; },
          skip() { return this; },
          limit() { return this; },
          async toArray() { return JSON.parse(JSON.stringify(results)); },
        };
      },
    };
  },
};

(globalThis as any).progeniMongoDb = Promise.resolve(mockDb);

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, any>,
    body: null as any,
    sentData: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: any) {
      this.headers[name] = value;
      return this;
    },
    send(data: any) {
      this.sentData = data;
      return this;
    },
  };
  return res;
}

function createMockRequest(options: {
  userId: string;
  role?: string;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, any>;
  ip?: string;
}): AuthRequest {
  return {
    userId: options.userId,
    userRole: options.role || 'candidate',
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    ip: options.ip || '127.0.0.1',
    headers: { 'x-forwarded-for': options.ip || '127.0.0.1' },
    socket: { remoteAddress: options.ip || '127.0.0.1' },
  } as any;
}

test('Resume Intelligence & Studio Subsystem', async (t) => {
  const candidateA = 'candidate-ai-user-1';
  const candidateB = 'candidate-ai-user-2';

  let masterResumeId: string;
  let sampleResumeId: string;
  let testClaimId: string;

  await t.test('Master Resume: initializes canonical career profile with personal info and sections', async () => {
    // Populate candidate A profile in mockDb first
    getCollectionData('candidate_profiles').push({
      _id: candidateA,
      user_id: candidateA,
      full_name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      phone: '+1 555-019-3829',
      city: 'San Francisco',
      country: 'USA',
      target_role: 'Lead Cloud Architect',
      skills: ['TypeScript', 'Node.js', 'Kubernetes', 'AWS', 'Docker', 'PostgreSQL'],
      work_experience: [
        {
          company: 'Acme Cloud Corp',
          title: 'Senior Cloud Engineer',
          startDate: '2021-01',
          endDate: 'Present',
          current: true,
          highlights: [
            'Architected distributed microservices platform processing 10M daily events',
            'Reduced AWS infrastructure spend by 35% through container optimization',
          ],
        },
      ],
      education: [
        {
          institution: 'Stanford University',
          degree: 'B.S.',
          fieldOfStudy: 'Computer Science',
          startYear: 2016,
          endYear: 2020,
        },
      ],
    });

    const req = createMockRequest({ userId: candidateA });
    const res = createMockResponse();

    await getMasterResumeHandler(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.resume.is_master, true);
    assert.equal(res.body.resume.content.personal_info.full_name, 'Elena Rostova');
    assert.equal(res.body.resume.content.personal_info.target_role, 'Lead Cloud Architect');
    assert.ok(res.body.resume.content.skills.length >= 6);
    assert.ok(res.body.resume.section_order.includes('experience'));
    assert.ok(res.body.resume.section_order.includes('skills'));

    masterResumeId = res.body.resume.id;
  });

  await t.test('Resume Studio: creates draft resume and updates sections with reordering', async () => {
    const createReq = createMockRequest({
      userId: candidateA,
      body: {
        title: 'Cloud Specialist CV',
        template: 'technical',
        section_order: ['skills', 'experience', 'projects', 'education', 'summary'],
        content: {
          personal_info: {
            full_name: 'Elena Rostova',
            email: 'elena.rostova@example.com',
            target_role: 'Kubernetes Platform Lead',
          },
          summary: 'Specialized Kubernetes & cloud infrastructure architect.',
          work_experience: [
            {
              company: 'Cloud Corp',
              role: 'Staff DevOps Architect',
              highlights: ['Orchestrated Kubernetes clusters across 3 multi-cloud regions'],
            },
          ],
          skills: [{ name: 'Kubernetes', category: 'cloud' }, { name: 'Terraform', category: 'cloud' }],
        },
      },
    });
    const createRes = createMockResponse();

    await createResumeHandler(createReq, createRes, (err) => {
      if (err) throw err;
    });

    assert.equal(createRes.statusCode, 201);
    assert.equal(createRes.body.ok, true);
    assert.equal(createRes.body.resume.template, 'technical');
    assert.equal(createRes.body.resume.section_order[0], 'skills');

    sampleResumeId = createRes.body.resume.id;

    // Update section ordering and template
    const updateReq = createMockRequest({
      userId: candidateA,
      params: { id: sampleResumeId },
      body: {
        template: 'executive',
        section_order: ['summary', 'skills', 'experience', 'education'],
      },
    });
    const updateRes = createMockResponse();

    await updateResumeHandler(updateReq, updateRes, (err) => {
      if (err) throw err;
    });

    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.body.resume.template, 'executive');
    assert.equal(updateRes.body.resume.section_order[0], 'summary');
  });

  await t.test('Resume Studio: publishes new version and records historical snapshot', async () => {
    const pubReq = createMockRequest({
      userId: candidateA,
      params: { id: sampleResumeId },
      body: { changeSummary: 'Promoted to staff role and added Terraform highlights' },
    });
    const pubRes = createMockResponse();

    await publishResumeHandler(pubReq, pubRes, (err) => {
      if (err) throw err;
    });

    assert.equal(pubRes.statusCode, 200);
    assert.equal(pubRes.body.resume.version, 2);
    assert.equal(pubRes.body.resume.status, 'published');
    assert.ok(pubRes.body.resume.version_history.length >= 2);
    assert.equal(pubRes.body.resume.version_history[1].version, 2);
  });

  await t.test('Resume Studio: restores past version from snapshot', async () => {
    const restoreReq = createMockRequest({
      userId: candidateA,
      params: { id: sampleResumeId },
      body: { version: 1 },
    });
    const restoreRes = createMockResponse();

    await restoreResumeHandler(restoreReq, restoreRes, (err) => {
      if (err) throw err;
    });

    assert.equal(restoreRes.statusCode, 200);
    assert.equal(restoreRes.body.resume.version, 3); // Restoring creates version 3 with content of version 1
    assert.ok(restoreRes.body.resume.version_history.length >= 3);
  });

  await t.test('Resume Studio: duplicates resume and preserves original', async () => {
    const dupReq = createMockRequest({
      userId: candidateA,
      params: { id: sampleResumeId },
      body: { title: 'Cloud Specialist CV (Fintech Variant)' },
    });
    const dupRes = createMockResponse();

    await duplicateResumeHandler(dupReq, dupRes, (err) => {
      if (err) throw err;
    });

    assert.equal(dupRes.statusCode, 201);
    assert.equal(dupRes.body.resume.title, 'Cloud Specialist CV (Fintech Variant)');
    assert.equal(dupRes.body.resume.is_master, false);
    assert.equal(dupRes.body.resume.version, 1);
  });

  await t.test('Security & IDOR Isolation: blocks Candidate B from accessing or mutating Candidate A resume', async () => {
    // Candidate B attempts to read Candidate A's resume
    const readReq = createMockRequest({
      userId: candidateB,
      params: { id: sampleResumeId },
    });
    const readRes = createMockResponse();
    await getResumeHandler(readReq, readRes, (err) => {
      if (err) throw err;
    });
    assert.equal(readRes.statusCode, 404);

    // Candidate B attempts to delete Candidate A's resume
    const delReq = createMockRequest({
      userId: candidateB,
      params: { id: sampleResumeId },
    });
    const delRes = createMockResponse();
    await deleteResumeHandler(delReq, delRes, (err) => {
      if (err) throw err;
    });
    assert.equal(delRes.statusCode, 404);
  });

  await t.test('Truth Engine: extracts claims with provenance and evidence links', async () => {
    const claims = await truthEngineService.extractClaimsFromResumeAnalysis(candidateA, masterResumeId, {
      fileName: 'elena_cv.pdf',
      detected: {
        fullName: 'Elena Rostova',
        experienceYears: 6,
        experienceEvidence: '6+ years of professional cloud engineering experience',
      },
      skills: [
        { skill: 'Kubernetes', evidence: 'Kubernetes cluster administration across multi-cloud' },
        { skill: 'AWS', evidence: 'Reduced AWS infrastructure costs by 35%' },
      ],
    });

    assert.equal(claims.length, 3);
    const k8sClaim = claims.find((c) => c.claim_text === 'Kubernetes');
    assert.ok(k8sClaim);
    assert.equal(k8sClaim.verification_status, 'verified_from_source');
    assert.equal(k8sClaim.candidate_confirmed, true);
    assert.ok(k8sClaim.supporting_source?.snippet?.includes('Kubernetes'));

    testClaimId = k8sClaim.id;
  });

  await t.test('Truth Engine: supports candidate confirmation and disputes unsupported claims', async () => {
    // Add an unverified manual claim
    const unverified = await truthEngineService.createClaim(candidateA, {
      resume_id: masterResumeId,
      category: 'certification',
      claim_text: 'AWS Certified Solutions Architect - Professional',
      candidate_confirmed: false,
    });
    assert.equal(unverified.verification_status, 'unverified');

    // Candidate confirms the certification
    const confirmed = await truthEngineService.confirmClaim(candidateA, unverified.id, true);
    assert.equal(confirmed.verification_status, 'candidate_confirmed');
    assert.equal(confirmed.candidate_confirmed, true);
    assert.ok(confirmed.confirmed_at);

    // Candidate disputes a claim -> status transitions to unsupported
    const disputed = await truthEngineService.confirmClaim(candidateA, unverified.id, false, 'Expired in 2022');
    assert.equal(disputed.verification_status, 'unsupported');
    assert.equal(disputed.confidence_score, 0);
  });

  await t.test('Resume Analyzer: computes explainable ATS compatibility score with transparent breakdown', async () => {
    const resumeText = `
Elena Rostova
elena.rostova@example.com | +1 555-019-3829 | San Francisco, USA | linkedin.com/in/elenarostova

PROFESSIONAL SUMMARY
Dedicated Lead Cloud Architect with 6+ years of experience in distributed systems, Kubernetes, and AWS infrastructure.

WORK EXPERIENCE
Staff DevOps Architect - Acme Cloud Corp (2021 - Present)
• Architected scalable microservices platform processing 10M+ daily events with 99.99% uptime.
• Reduced annual cloud expenditure by 35% using container rightsizing and auto-scaling.
• Spearheaded migration of legacy services to Kubernetes, decreasing deployment latency by 60%.

EDUCATION
Stanford University - B.S. in Computer Science (2016 - 2020)

TECHNICAL SKILLS
Kubernetes, Docker, AWS, TypeScript, Node.js, Terraform, PostgreSQL, Distributed Systems
`;

    const diagnosis = resumeAnalyzerService.diagnoseATS(resumeText);

    assert.ok(diagnosis.overallScore >= 75, `Expected score >= 75, got ${diagnosis.overallScore}`);
    assert.ok(diagnosis.categories.contactInfo.earnedScore >= 18);
    assert.ok(diagnosis.categories.sectionHeadings.earnedScore >= 18);
    assert.ok(diagnosis.categories.quantifiableImpact.earnedScore >= 15);
    assert.ok(diagnosis.metricsFound.length >= 3);
    assert.ok(diagnosis.actionVerbsFound.includes('architected') || diagnosis.actionVerbsFound.includes('spearheaded'));
    assert.ok(diagnosis.disclaimer.includes('internal algorithmic heuristic'));
  });

  await t.test('Resume Analyzer: compares resume against Job Description and detects keyword gaps', async () => {
    const resumeText = 'Elena Rostova - Cloud Architect with expertise in Kubernetes, AWS, Docker, TypeScript, PostgreSQL';
    const candidateSkills = ['Kubernetes', 'AWS', 'Docker', 'TypeScript', 'PostgreSQL'];
    const jobDescription = `
We are seeking a Lead DevOps Engineer proficient in Kubernetes, AWS, and Docker.
Must have experience with Terraform and Python for cloud automation.
`;

    const comparison = resumeAnalyzerService.compareWithJobDescription(resumeText, candidateSkills, jobDescription);

    assert.ok(comparison.matchedKeywords.includes('kubernetes'));
    assert.ok(comparison.matchedKeywords.includes('aws'));
    assert.ok(comparison.matchedKeywords.includes('docker'));
    assert.ok(comparison.missingKeywords.includes('terraform') || comparison.missingKeywords.includes('python'));
    assert.ok(comparison.matchPercentage > 40 && comparison.matchPercentage < 90);
    assert.ok(comparison.recommendations.length > 0);
  });

  await t.test('Targeted Resume Generator: strictly grounded in verified facts, highlights gaps, zero fabrication', async () => {
    const jdText = `
Role: Senior Kubernetes Platform Architect
Company: CloudScale AI
Requirements:
- Deep expertise in Kubernetes, AWS, and Docker
- Hands-on experience with Golang and Kafka
- Experience with microservices scalability and cost reduction
`;

    const result = await targetedResumeService.generateTargetedResume(candidateA, {
      baseResumeId: masterResumeId,
      jobDescription: jdText,
      targetRole: 'Senior Kubernetes Platform Architect',
      targetCompany: 'CloudScale AI',
    });

    assert.equal(result.requiresHumanReview, true);
    assert.ok(result.diff.summary.targeted.includes('Senior Kubernetes Platform Architect'));
    assert.ok(result.matchedKeywords.includes('kubernetes'));
    assert.ok(result.matchedKeywords.includes('aws'));

    // Verify Grounding: Golang & Kafka are missing in candidate profile; they must be listed as missing and NOT fabricated
    assert.ok(result.missingRequirements.includes('golang') || result.missingRequirements.includes('kafka'));
    const targetedSkills = result.targetedResume.content.skills.map((s) => s.name.toLowerCase());
    assert.equal(targetedSkills.includes('golang'), false, 'Targeted resume must NOT fabricate missing skills');
    assert.equal(targetedSkills.includes('kafka'), false, 'Targeted resume must NOT fabricate missing skills');

    assert.ok(result.groundingAttestation.includes('strictly derived from verified candidate profile records'));
  });

  await t.test('PDF Exporter: generates valid %PDF-1.4 buffer with headers and content', async () => {
    const resume = await resumeStudioService.getMasterResume(candidateA);
    const pdfBuf = await resumeExportService.exportPdf(candidateA, resume, '127.0.0.1');

    assert.ok(Buffer.isBuffer(pdfBuf));
    assert.equal(pdfBuf.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.ok(pdfBuf.length > 500);

    // Verify audit log entry was created
    const logs = getCollectionData('resume_export_logs');
    const pdfLog = logs.find((l) => l.user_id === candidateA && l.format === 'pdf');
    assert.ok(pdfLog);
  });

  await t.test('DOCX Exporter: generates valid PK zip buffer parseable by mammoth', async () => {
    const resume = await resumeStudioService.getMasterResume(candidateA);
    const docxBuf = await resumeExportService.exportDocx(candidateA, resume, '127.0.0.1');

    assert.ok(Buffer.isBuffer(docxBuf));
    assert.equal(docxBuf.subarray(0, 2).toString('ascii'), 'PK');
    assert.ok(docxBuf.length > 500);

    // Verify mammoth parses it cleanly
    const extracted = await mammoth.extractRawText({ buffer: docxBuf });
    assert.ok(extracted.value.includes('Elena Rostova'));
    assert.ok(extracted.value.includes('WORK EXPERIENCE') || extracted.value.includes('PROFESSIONAL SUMMARY'));

    // Verify audit log entry
    const logs = getCollectionData('resume_export_logs');
    const docxLog = logs.find((l) => l.user_id === candidateA && l.format === 'docx');
    assert.ok(docxLog);
  });
});
