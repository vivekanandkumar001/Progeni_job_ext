import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middlewares/auth.js';
import { resumeStudioService } from '../services/resumeStudioService.js';
import { resumeAnalyzerService } from '../services/resumeAnalyzerService.js';
import { targetedResumeService } from '../services/targetedResumeService.js';
import { truthEngineService, type ClaimCategory } from '../services/truthEngineService.js';
import { resumeExportService } from '../services/resumeExportService.js';
import { extractClientIp } from '../services/authAuditService.js';

// --- Zod Validation Schemas ---

const personalInfoSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  target_role: z.string().trim().max(120).nullable().optional(),
  linkedin_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  github_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  portfolio_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  website_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
});

const workExperienceSchema = z.object({
  id: z.string().optional(),
  company: z.string().trim().min(1).max(150),
  role: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).nullable().optional(),
  start_date: z.string().trim().max(50).nullable().optional(),
  end_date: z.string().trim().max(50).nullable().optional(),
  current: z.boolean().optional(),
  highlights: z.array(z.string().trim().max(500)).max(25),
  technologies: z.array(z.string().trim().max(80)).max(30).optional(),
});

const educationSchema = z.object({
  id: z.string().optional(),
  institution: z.string().trim().min(1).max(150),
  degree: z.string().trim().min(1).max(120),
  field_of_study: z.string().trim().max(120).nullable().optional(),
  start_year: z.number().int().min(1950).max(2100).nullable().optional(),
  end_year: z.number().int().min(1950).max(2100).nullable().optional(),
  grade: z.string().trim().max(50).nullable().optional(),
});

const skillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().max(50).optional(),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  is_verified: z.boolean().optional(),
});

const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(600).nullable().optional(),
  url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  github_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  technologies: z.array(z.string().trim().max(80)).max(30),
  highlights: z.array(z.string().trim().max(300)).max(15).optional(),
});

const certificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(150),
  issuer: z.string().trim().min(1).max(150),
  issue_date: z.string().trim().max(50).nullable().optional(),
  expiration_date: z.string().trim().max(50).nullable().optional(),
  credential_id: z.string().trim().max(100).nullable().optional(),
  credential_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
});

const achievementSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500),
  date: z.string().trim().max(50).nullable().optional(),
});

const languageSchema = z.object({
  language: z.string().trim().min(1).max(80),
  proficiency: z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']),
});

const resumeContentSchema = z.object({
  personal_info: personalInfoSchema,
  summary: z.string().trim().max(2000).nullable().optional(),
  work_experience: z.array(workExperienceSchema).max(30).optional(),
  education: z.array(educationSchema).max(20).optional(),
  skills: z.array(skillSchema).max(100).optional(),
  projects: z.array(projectSchema).max(30).optional(),
  certifications: z.array(certificationSchema).max(30).optional(),
  achievements: z.array(achievementSchema).max(30).optional(),
  languages: z.array(languageSchema).max(20).optional(),
});

const resumeStudioPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  template: z.enum(['classic', 'modern', 'technical', 'executive']).optional(),
  section_order: z.array(z.string().trim()).max(20).optional(),
  target_job_title: z.string().trim().max(120).nullable().optional(),
  target_company: z.string().trim().max(120).nullable().optional(),
  content: resumeContentSchema.partial().optional(),
});

const targetedGenerateSchema = z.object({
  baseResumeId: z.string().optional(),
  jobDescription: z.string().trim().min(20).max(50000),
  targetRole: z.string().trim().max(120).optional(),
  targetCompany: z.string().trim().max(120).optional(),
  jobId: z.string().optional(),
});

const claimConfirmSchema = z.object({
  confirmed: z.boolean(),
  notes: z.string().trim().max(500).optional(),
});

const claimCreateSchema = z.object({
  resume_id: z.string().optional(),
  category: z.enum([
    'skill',
    'experience_years',
    'employment_history',
    'education',
    'certification',
    'project',
    'measurable_achievement',
  ]),
  claim_text: z.string().trim().min(1).max(500),
  candidate_confirmed: z.boolean().optional(),
  supporting_source: z
    .object({
      type: z.enum(['uploaded_document', 'github_repo', 'credential_url', 'profile_entry', 'manual_claim']),
      ref: z.string().max(300),
      snippet: z.string().max(1000).optional(),
    })
    .optional(),
});

// --- Controller Actions ---

export async function getMasterResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resume = await resumeStudioService.getMasterResume(req.userId!);
    res.json({ ok: true, resume });
  } catch (error) {
    next(error);
  }
}

export async function listResumesHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumes = await resumeStudioService.listResumes(req.userId!);
    res.json({ ok: true, resumes });
  } catch (error) {
    next(error);
  }
}

export async function getResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resume = await resumeStudioService.getResume(req.userId!, req.params.id);
    if (!resume) {
      res.status(404).json({ ok: false, error: 'Resume not found or access denied.' });
      return;
    }
    res.json({ ok: true, resume });
  } catch (error) {
    next(error);
  }
}

export async function createResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = resumeStudioPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume data', details: parsed.error.flatten() });
    return;
  }
  try {
    const created = await resumeStudioService.createResume(req.userId!, parsed.data as any);
    res.status(201).json({ ok: true, resume: created });
  } catch (error) {
    next(error);
  }
}

export async function updateResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = resumeStudioPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume update payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await resumeStudioService.updateResume(req.userId!, req.params.id, parsed.data as any);
    res.json({ ok: true, resume: updated });
  } catch (error) {
    next(error);
  }
}

export async function publishResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const changeSummary = req.body?.changeSummary || 'Published updated version';
    const published = await resumeStudioService.publishVersion(req.userId!, req.params.id, changeSummary);
    res.json({ ok: true, resume: published });
  } catch (error) {
    next(error);
  }
}

export async function restoreResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const version = Number(req.body?.version);
  if (!version || isNaN(version)) {
    res.status(400).json({ ok: false, error: 'Valid target version number is required.' });
    return;
  }
  try {
    const restored = await resumeStudioService.restoreVersion(req.userId!, req.params.id, version);
    res.json({ ok: true, resume: restored });
  } catch (error) {
    next(error);
  }
}

export async function duplicateResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const newTitle = req.body?.title;
    const duplicated = await resumeStudioService.duplicateResume(req.userId!, req.params.id, newTitle);
    res.status(201).json({ ok: true, resume: duplicated });
  } catch (error) {
    next(error);
  }
}

export async function deleteResumeHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await resumeStudioService.deleteResume(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Resume not found or access denied.' });
      return;
    }
    res.json({ ok: true, deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function diagnoseATSHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const { resumeText, resumeId } = req.body;
  try {
    let textToAnalyze = resumeText;
    if (!textToAnalyze && resumeId) {
      const resume = await resumeStudioService.getResume(req.userId!, resumeId);
      if (resume) {
        textToAnalyze = JSON.stringify(resume.content);
      }
    }
    if (!textToAnalyze) {
      res.status(400).json({ ok: false, error: 'Please provide resumeText or a valid resumeId.' });
      return;
    }
    const diagnosis = resumeAnalyzerService.diagnoseATS(textToAnalyze);
    res.json({ ok: true, diagnosis });
  } catch (error) {
    next(error);
  }
}

export async function compareJDHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const { resumeText, candidateSkills, jobDescription, resumeId } = req.body;
  if (!jobDescription || jobDescription.trim().length < 10) {
    res.status(400).json({ ok: false, error: 'Please provide a valid job description.' });
    return;
  }
  try {
    let text = resumeText || '';
    let skills = Array.isArray(candidateSkills) ? candidateSkills : [];

    if (resumeId) {
      const resume = await resumeStudioService.getResume(req.userId!, resumeId);
      if (resume) {
        text = text || JSON.stringify(resume.content);
        skills = skills.length ? skills : (resume.content.skills || []).map((s) => s.name);
      }
    }

    const comparison = resumeAnalyzerService.compareWithJobDescription(text, skills, jobDescription);
    res.json({ ok: true, comparison });
  } catch (error) {
    next(error);
  }
}

export async function generateTargetedHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = targetedGenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid targeted generation request', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await targetedResumeService.generateTargetedResume(req.userId!, parsed.data);
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function listClaimsHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const { resume_id, category, status } = req.query as {
    resume_id?: string;
    category?: ClaimCategory;
    status?: any;
  };
  try {
    const claims = await truthEngineService.getClaims(req.userId!, { resume_id, category, status });
    res.json({ ok: true, claims });
  } catch (error) {
    next(error);
  }
}

export async function createClaimHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = claimCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid claim data', details: parsed.error.flatten() });
    return;
  }
  try {
    const claim = await truthEngineService.createClaim(req.userId!, parsed.data);
    res.status(201).json({ ok: true, claim });
  } catch (error) {
    next(error);
  }
}

export async function confirmClaimHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = claimConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid confirmation payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await truthEngineService.confirmClaim(
      req.userId!,
      req.params.claimId,
      parsed.data.confirmed,
      parsed.data.notes,
    );
    res.json({ ok: true, claim: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteClaimHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await truthEngineService.deleteClaim(req.userId!, req.params.claimId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Claim not found or access denied.' });
      return;
    }
    res.json({ ok: true, deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function exportPdfHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resume = await resumeStudioService.getResume(req.userId!, req.params.id);
    if (!resume) {
      res.status(404).json({ ok: false, error: 'Resume not found or access denied.' });
      return;
    }
    const clientIp = extractClientIp(req);
    const pdfBuffer = await resumeExportService.exportPdf(req.userId!, resume, clientIp);

    const safeTitle = (resume.title || 'resume').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function exportDocxHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resume = await resumeStudioService.getResume(req.userId!, req.params.id);
    if (!resume) {
      res.status(404).json({ ok: false, error: 'Resume not found or access denied.' });
      return;
    }
    const clientIp = extractClientIp(req);
    const docxBuffer = await resumeExportService.exportDocx(req.userId!, resume, clientIp);

    const safeTitle = (resume.title || 'resume').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
    res.setHeader('Content-Length', docxBuffer.length);
    res.send(docxBuffer);
  } catch (error) {
    next(error);
  }
}

