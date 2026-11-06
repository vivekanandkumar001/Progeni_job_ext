import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { resumeService } from '../services/resumeService.js';

const resumeUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(200).optional(),
  file_name: z.string().trim().max(255).nullable().optional(),
  file_url: z.string().url().max(2048).nullable().optional(),
  file_type: z.enum(['pdf', 'docx', 'txt']).nullable().optional(),
  parsed_text: z.string().max(100000).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).nullable().optional(),
  experience_years: z.number().min(0).max(80).nullable().optional(),
  sections: z.record(z.string(), z.unknown()).nullable().optional(),
  ats_score: z.number().min(0).max(100).nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function listResumes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resumes = await resumeService.list(req.userId!);
    res.json({ ok: true, resumes, isDemo: resumes.length === 0 });
  } catch (error) {
    next(error);
  }
}

export async function getResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const resume = await resumeService.get(req.params.id, req.userId!);
    if (!resume) {
      res.status(404).json({ ok: false, error: 'Resume not found' });
      return;
    }
    res.json({ ok: true, resume });
  } catch (error) {
    next(error);
  }
}

export async function upsertResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = resumeUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume data', details: parsed.error.flatten() });
    return;
  }
  try {
    const resume = await resumeService.upsert(req.userId!, parsed.data);
    res.json({ ok: true, resume });
  } catch (error) {
    next(error);
  }
}

export async function deleteResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await resumeService.delete(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
