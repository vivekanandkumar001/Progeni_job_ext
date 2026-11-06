import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authMiddleware, requireRole, type AuthRequest } from '../middlewares/auth.js';
import { env } from '../config/env.js';
import { checkHardEligibility, calculateMatchScore } from '../services/matchingEngine.js';
import { localDataStore, type CandidateWorkspaceStore } from '../services/localDataStore.js';
import { mongoWorkspaceStore } from '../services/mongoWorkspaceStore.js';
import { analyzeResume, ResumeParseError, type ResumeFileType } from '../services/resumeParser.js';

const localUserId = 'local-candidate';

const profileSchema = z.object({
  fullName: z.string().trim().max(120).default(''),
  email: z.string().trim().email().or(z.literal('')).default(''),
  phone: z.string().trim().max(40).default(''),
  targetRole: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  experienceYears: z.number().min(0).max(80).nullable().default(null),
});

const jobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).default(''),
  location: z.string().trim().max(200).default(''),
  description: z.string().max(50000).default(''),
  url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)),
  platform: z.string().trim().max(100).default('manual'),
  requiredSkills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  experienceMin: z.number().min(0).max(80).nullable().default(null),
});

const applicationSchema = z.object({
  jobId: z.string().uuid(),
});

const applicationUpdateSchema = z.object({
  status: z.enum(['discovered', 'prepared', 'submitted', 'interview', 'rejected', 'withdrawn']),
  notes: z.string().trim().max(4000).optional(),
});

const resumeParseSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['pdf', 'docx', 'txt']),
  contentBase64: z.string().min(4).max(7_000_000).regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    'Resume file data must be valid base64.',
  ),
});

const resumeSaveSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['pdf', 'docx', 'txt']),
  skills: z.array(z.object({
    skill: z.string().trim().min(1).max(80),
    evidence: z.string().trim().max(280),
  })).max(50),
  experienceYears: z.number().min(0).max(80).nullable(),
  experienceEvidence: z.string().trim().max(120).nullable(),
  profile: profileSchema,
});

function isLocalDevelopmentRequest(req: Request): boolean {
  const address = req.socket.remoteAddress;
  return (
    env.NODE_ENV === 'development' &&
    !env.SUPABASE_URL &&
    (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1')
  );
}

function requireUserId(req: AuthRequest): string {
    if (!req.userId) throw new Error('Authenticated request is missing a user ID.');
    return req.userId;
}

function createWorkspaceRoutes(store: CandidateWorkspaceStore) {
    const router = Router();

    router.use(authMiddleware, requireRole('candidate', 'premium_candidate'));

    router.get('/consent', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, accepted: await store.hasConsent(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.post('/consent', async (req: AuthRequest, res, next) => {
      if (req.body?.accepted !== true) {
        res.status(400).json({ ok: false, error: 'Consent must be explicitly accepted.' });
        return;
      }
      try {
        res.json({
          ok: true,
          accepted: true,
          acceptedAt: await store.saveConsent(requireUserId(req)),
        });
      } catch (error) {
        next(error);
      }
    });

    router.use(async (req: AuthRequest, res, next) => {
      try {
        if (!(await store.hasConsent(requireUserId(req)))) {
          res.status(403).json({
            ok: false,
            code: 'CONSENT_REQUIRED',
            error: 'Accept the data notice before using candidate workspace features.',
          });
          return;
        }
        next();
      } catch (error) {
        next(error);
      }
    });

    router.get('/profile', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, profile: await store.getProfile(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.post('/resumes/parse', async (req, res, next) => {
      const parsed = resumeParseSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'Invalid resume upload.', details: parsed.error.flatten() });
        return;
      }
      const expectedExtension = `.${parsed.data.fileType}`;
      if (!parsed.data.fileName.toLocaleLowerCase().endsWith(expectedExtension)) {
        res.status(400).json({ ok: false, error: `Choose a file with the ${expectedExtension} extension.` });
        return;
      }
      const buffer = Buffer.from(parsed.data.contentBase64, 'base64');
      if (buffer.length > 5 * 1024 * 1024) {
        res.status(413).json({ ok: false, error: 'Resume files must be 5 MB or smaller.' });
        return;
      }
      if (buffer.toString('base64') !== parsed.data.contentBase64) {
        res.status(400).json({ ok: false, error: 'Resume file data is not valid base64.' });
        return;
      }
      try {
        const analysis = await analyzeResume(parsed.data.fileName, parsed.data.fileType as ResumeFileType, buffer);
        res.json({ ok: true, analysis });
      } catch (error) {
        if (error instanceof ResumeParseError) {
          res.status(422).json({ ok: false, error: error.message });
          return;
        }
        next(error);
      }
    });

    router.get('/resumes', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, resumes: await store.listResumes(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.post('/resumes', async (req: AuthRequest, res, next) => {
      const parsed = resumeSaveSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'Invalid reviewed resume details.', details: parsed.error.flatten() });
        return;
      }
      try {
        const skills = [...new Map(
          parsed.data.skills.map((item) => [item.skill.toLocaleLowerCase(), item]),
        ).values()];
        const resume = await store.saveResume(
          requireUserId(req),
          {
            fileName: parsed.data.fileName,
            fileType: parsed.data.fileType,
            skills,
            experienceYears: parsed.data.experienceYears,
            experienceEvidence: parsed.data.experienceEvidence,
          },
          {
            ...parsed.data.profile,
            skills: [...new Set(parsed.data.profile.skills.map((skill) => skill.trim()).filter(Boolean))],
          },
        );
        res.status(201).json({ ok: true, resume });
      } catch (error) {
        next(error);
      }
    });

    router.delete('/resumes/:id', async (req: AuthRequest, res, next) => {
      try {
        const deleted = await store.deleteResume(requireUserId(req), req.params.id);
        if (!deleted) {
          res.status(404).json({ ok: false, error: 'Resume not found.' });
          return;
        }
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    });

    router.put('/profile', async (req: AuthRequest, res, next) => {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'Invalid profile.', details: parsed.error.flatten() });
        return;
      }
      try {
        const profile = await store.saveProfile(requireUserId(req), {
          ...parsed.data,
          skills: [...new Set(parsed.data.skills.map((skill) => skill.trim()).filter(Boolean))],
        });
        res.json({ ok: true, profile });
      } catch (error) {
        next(error);
      }
    });

    router.get('/jobs', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, jobs: await store.listJobs(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.post('/matches/analyze', async (req: AuthRequest, res, next) => {
      const parsed = jobSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'Invalid job details.', details: parsed.error.flatten() });
        return;
      }
      try {
        const userId = requireUserId(req);
        const profile = await store.getProfile(userId);
        const job = parsed.data;
        const resumes = await store.listResumes(userId);
        const candidateSkills = profile?.skills || [];
        const candidate = {
          skills: profile?.skills,
          experienceYears: profile?.experienceYears ?? undefined,
        };
        const factors: Record<string, number> = {};
        const explanations: string[] = [];
        const missingEvidence: string[] = [];
        const evidence: string[] = [];

        if (job.requiredSkills.length > 0) {
          if (candidateSkills.length === 0) {
            missingEvidence.push('Candidate skills have not been added to the profile.');
            explanations.push('Skill match is unknown until your skills are in the profile.');
          } else {
            const skills = new Set(candidateSkills.map((skill) => skill.toLocaleLowerCase()));
            const matchedSkills = job.requiredSkills.filter((skill) =>
              skills.has(skill.toLocaleLowerCase()),
            );
            const unmatchedSkills = job.requiredSkills.filter(
              (skill) => !skills.has(skill.toLocaleLowerCase()),
            );
            factors.skills = Math.round((matchedSkills.length / job.requiredSkills.length) * 100);
            explanations.push(
              `${matchedSkills.length} of ${job.requiredSkills.length} skills listed in the job details match your profile.`,
            );
            if (matchedSkills.length > 0) {
              evidence.push(`Profile skills matching the listing: ${matchedSkills.join(', ')}.`);
              const resumeEvidence = resumes
                .flatMap((resume) => resume.skills)
                .filter((item) => matchedSkills.some((skill) => skill.toLocaleLowerCase() === item.skill.toLocaleLowerCase()));
              for (const item of resumeEvidence) {
                evidence.push(`Resume evidence for ${item.skill}: “${item.evidence}”`);
              }
            }
            if (unmatchedSkills.length > 0) {
              missingEvidence.push(`Skills not listed in your profile: ${unmatchedSkills.join(', ')}.`);
            }
          }
          explanations.push('Skills mentioned in a listing are not assumed to be mandatory requirements.');
        } else {
          missingEvidence.push('Job skills were not available.');
        }

        if (job.experienceMin !== null) {
          if (profile?.experienceYears === null || profile?.experienceYears === undefined) {
            missingEvidence.push('Candidate experience is not known.');
            explanations.push('Experience match is unknown until you add your experience to the profile.');
          } else {
            factors.experience =
              profile.experienceYears >= job.experienceMin
                ? 100
                : Math.max(0, Math.round((profile.experienceYears / Math.max(job.experienceMin, 1)) * 100));
            explanations.push(
              `Your ${profile.experienceYears} years of experience ${
                profile.experienceYears >= job.experienceMin ? 'meets' : 'is below'
              } the stated minimum of ${job.experienceMin} years.`,
            );
            for (const resume of resumes) {
              if (resume.experienceYears === profile.experienceYears && resume.experienceEvidence) {
                evidence.push(`Resume evidence for experience: “${resume.experienceEvidence}”`);
              }
            }
          }
        }

        if (profile?.targetRole && job.title) {
          const targetWords = new Set(
            profile.targetRole.toLocaleLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2),
          );
          const titleWords = job.title.toLocaleLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2);
          const overlap = titleWords.some((word) => targetWords.has(word));
          factors.role = overlap ? 100 : 0;
          explanations.push(
            overlap
              ? 'The job title overlaps with your target role.'
              : 'The job title does not directly overlap with your target role.',
          );
        }

        const scoreResult = calculateMatchScore(factors);
        const eligibility = checkHardEligibility(candidate, {
          mandatorySkills: [],
          experienceMin: job.experienceMin ?? undefined,
        });
        const match = await store.saveMatch(userId, job, {
          score: scoreResult.score,
          factors,
          explanation: explanations.length > 0
            ? explanations
            : ['Not enough profile or job requirements were provided to calculate a meaningful score.'],
          missingEvidence: [...new Set([...scoreResult.missingEvidence, ...missingEvidence])],
          eligible: eligibility.eligible && missingEvidence.length === 0,
          blockers: eligibility.blockers,
          unknowns: eligibility.unknowns,
          evidence: [...eligibility.evidence, ...evidence],
        });
        res.json({ ok: true, match });
      } catch (error) {
        next(error);
      }
    });

    router.get('/matches', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, matches: await store.listMatches(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.delete('/workspace', async (req: AuthRequest, res, next) => {
      try {
        await store.clearWorkspace(requireUserId(req));
        res.json({ ok: true, cleared: true });
      } catch (error) {
        next(error);
      }
    });

    router.get('/applications', async (req: AuthRequest, res, next) => {
      try {
        res.json({ ok: true, applications: await store.listApplications(requireUserId(req)) });
      } catch (error) {
        next(error);
      }
    });

    router.post('/applications', async (req: AuthRequest, res, next) => {
      const parsed = applicationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'A valid job id is required.' });
        return;
      }
      try {
        const application = await store.createApplication(requireUserId(req), parsed.data.jobId);
        res.status(201).json({ ok: true, application });
      } catch (error) {
        if (error instanceof Error && error.message === 'Job not found.') {
          res.status(404).json({ ok: false, error: error.message });
          return;
        }
        next(error);
      }
    });

    router.patch('/applications/:id', async (req: AuthRequest, res, next) => {
      const parsed = applicationUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ ok: false, error: 'Invalid application update.', details: parsed.error.flatten() });
        return;
      }
      try {
        const application = await store.updateApplication(
          requireUserId(req),
          req.params.id,
          parsed.data.status,
          parsed.data.notes,
        );
        if (!application) {
          res.status(404).json({ ok: false, error: 'Application not found.' });
          return;
        }
        res.json({ ok: true, application });
      } catch (error) {
        next(error);
      }
    });

    return router;
}

const localSessionRoutes = Router();
localSessionRoutes.post('/session', (req, res) => {
    if (!isLocalDevelopmentRequest(req)) {
      res.status(404).json({ ok: false, error: 'Local sessions are available only in local development.' });
      return;
    }
    const token = jwt.sign(
      { userId: localUserId, role: 'candidate' },
      env.JWT_SECRET,
      { expiresIn: '1d' },
    );
    res.json({ ok: true, token, userId: localUserId });
});

export const localMvpRoutes = Router()
    .use(localSessionRoutes)
    .use(createWorkspaceRoutes(localDataStore));
export const productionWorkspaceRoutes = createWorkspaceRoutes(mongoWorkspaceStore);
export default localMvpRoutes;
