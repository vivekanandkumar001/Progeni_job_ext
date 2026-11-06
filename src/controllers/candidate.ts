import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middlewares/auth.js';
import { candidateProfileService } from '../services/candidateProfileService.js';
import { candidatePreferencesService } from '../services/candidatePreferencesService.js';
import { candidateOnboardingService } from '../services/candidateOnboardingService.js';
import { resumeService } from '../services/resumeService.js';
import { analyzeResume, ResumeParseError, type ResumeFileType } from '../services/resumeParser.js';
import { extractClientIp } from '../services/authAuditService.js';

// --- Zod Validation Schemas ---

const educationSchema = z.object({
  institution: z.string().trim().min(1).max(150),
  degree: z.string().trim().min(1).max(120),
  fieldOfStudy: z.string().trim().max(120).optional(),
  startYear: z.number().int().min(1950).max(2100).optional(),
  endYear: z.number().int().min(1950).max(2100).optional(),
});

const experienceSchema = z.object({
  company: z.string().trim().min(1).max(150),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional(),
  startDate: z.string().trim().max(50).optional(),
  endDate: z.string().trim().max(50).optional(),
  current: z.boolean().optional(),
  highlights: z.array(z.string().trim().max(300)).max(20).optional(),
});

const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  url: z.string().url().max(2048).optional(),
  technologies: z.array(z.string().trim().max(80)).max(30).optional(),
});

const certificationSchema = z.object({
  name: z.string().trim().min(1).max(150),
  issuer: z.string().trim().max(120).optional(),
  issueDate: z.string().trim().max(50).optional(),
});

export const candidateProfilePatchSchema = z.object({
  full_name: z.string().trim().min(1).max(120).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  target_role: z.string().trim().max(120).nullable().optional(),
  experience_level: z.string().trim().max(50).nullable().optional(),
  location: z.string().trim().max(150).nullable().optional(),
  linkedin_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  github_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  portfolio_url: z.string().url().max(2048).or(z.literal('')).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).nullable().optional(),
  experience_years: z.number().min(0).max(80).nullable().optional(),
  education: z.array(educationSchema).max(20).nullable().optional(),
  work_experience: z.array(experienceSchema).max(30).nullable().optional(),
  projects: z.array(projectSchema).max(30).nullable().optional(),
  certifications: z.array(certificationSchema).max(30).nullable().optional(),
});

export const candidatePreferencesPatchSchema = z.object({
  desired_roles: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  preferred_locations: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  workplace_type: z.enum(['remote', 'hybrid', 'office', 'any']).optional(),
  expected_salary: z.object({
    currency: z.string().trim().length(3).optional(),
    min: z.number().min(0).nullable().optional(),
    max: z.number().min(0).nullable().optional(),
    period: z.enum(['yearly', 'monthly']).optional(),
  }).optional(),
  experience_level: z.enum(['entry', 'mid', 'senior', 'lead', 'executive']).optional(),
  joining_availability: z.enum(['immediate', '15_days', '30_days', '60_days', '90_days']).optional(),
  employment_type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
});

export const resumeUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(['pdf', 'docx', 'txt']),
  contentBase64: z.string().min(4).max(7_500_000).regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    'Resume file data must be valid base64.',
  ),
  title: z.string().trim().max(150).optional(),
});

export const onboardingPatchSchema = z.object({
  step: z.number().int().min(1).max(5).optional(),
  completeStep: z.number().int().min(1).max(5).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  dataProcessingConsent: z.boolean().optional(),
  jobAssistanceConsent: z.boolean().optional(),
});

// --- Controller Functions ---

/**
 * GET /api/v1/candidate/profile
 */
export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const profile = await candidateProfileService.get(userId);
    const completeness = candidateProfileService.calculateCompleteness(profile);
    res.json({
      ok: true,
      profile: profile || null,
      completeness,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/candidate/profile
 */
export async function patchProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = candidateProfilePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid profile data', details: parsed.error.flatten() });
    return;
  }

  try {
    const userId = req.userId!;
    const updated = await candidateProfileService.patch(userId, parsed.data);
    const completeness = candidateProfileService.calculateCompleteness(updated);
    res.json({
      ok: true,
      profile: updated,
      completeness,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/candidate/preferences
 */
export async function getPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const preferences = await candidatePreferencesService.get(userId);
    res.json({
      ok: true,
      preferences: preferences || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/candidate/preferences
 */
export async function patchPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = candidatePreferencesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid preferences data', details: parsed.error.flatten() });
    return;
  }

  try {
    const userId = req.userId!;
    const updated = await candidatePreferencesService.patch(userId, parsed.data);
    res.json({
      ok: true,
      preferences: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/candidate/resume
 * Uploads, parses, and saves a new resume version for the candidate.
 */
export async function uploadResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = resumeUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume upload payload', details: parsed.error.flatten() });
    return;
  }

  const { fileName, fileType, contentBase64, title } = parsed.data;
  const expectedExtension = `.${fileType}`;
  if (!fileName.toLowerCase().endsWith(expectedExtension)) {
    res.status(400).json({ ok: false, error: `File name extension must match .${fileType}` });
    return;
  }

  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(413).json({ ok: false, error: 'Resume file must be 5 MB or smaller.' });
    return;
  }

  try {
    const userId = req.userId!;
    const result = await resumeService.uploadAndAnalyze(userId, fileName, fileType as ResumeFileType, buffer, title);
    res.status(201).json({
      ok: true,
      resume: result.resume,
      analysis: result.analysis,
    });
  } catch (error) {
    if (error instanceof ResumeParseError) {
      res.status(422).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/v1/candidate/resume/parse
 * Parses resume without persisting it (for preview and candidate confirmation).
 */
export async function parseResumePreview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = resumeUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume upload payload', details: parsed.error.flatten() });
    return;
  }

  const { fileName, fileType, contentBase64 } = parsed.data;
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(413).json({ ok: false, error: 'Resume file must be 5 MB or smaller.' });
    return;
  }

  try {
    const analysis = await analyzeResume(fileName, fileType as ResumeFileType, buffer);
    res.json({
      ok: true,
      analysis,
    });
  } catch (error) {
    if (error instanceof ResumeParseError) {
      res.status(422).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

/**
 * GET /api/v1/candidate/resumes
 */
export async function listResumes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const resumes = await resumeService.list(userId);
    res.json({
      ok: true,
      resumes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/candidate/resumes/:id
 */
export async function deleteResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const deleted = await resumeService.delete(req.params.id, userId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Resume not found or does not belong to you.' });
      return;
    }
    res.json({ ok: true, deleted: true });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/candidate/onboarding
 */
export async function getOnboarding(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId!;
    const status = await candidateOnboardingService.getFullStatus(userId);
    res.json({
      ok: true,
      ...status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/candidate/onboarding
 */
export async function patchOnboarding(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = onboardingPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid onboarding payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const userId = req.userId!;
    const clientIp = extractClientIp(req);
    const updated = await candidateOnboardingService.updateProgress(userId, parsed.data, clientIp);
    const status = await candidateOnboardingService.getFullStatus(userId);
    res.json({
      ok: true,
      onboarding: updated,
      completeness: status.completeness,
      extensionConnected: status.extensionConnected,
    });
  } catch (error) {
    next(error);
  }
}

