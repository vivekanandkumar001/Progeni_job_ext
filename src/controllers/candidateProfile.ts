import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { candidateProfileService } from '../services/candidateProfileService.js';

const profileUpsertSchema = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().or(z.literal('')).nullable().optional(),
  target_role: z.string().trim().max(120).nullable().optional(),
  experience_level: z.string().trim().max(50).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  resume_completeness: z.number().min(0).max(100).optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).nullable().optional(),
  experience_years: z.number().min(0).max(80).nullable().optional(),
});

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await candidateProfileService.get(req.userId!);
    res.json({ ok: true, profile: profile || null, isDemo: !profile });
  } catch (error) {
    next(error);
  }
}

export async function upsertProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = profileUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid profile data', details: parsed.error.flatten() });
    return;
  }
  try {
    const profile = await candidateProfileService.upsert(req.userId!, parsed.data);
    res.json({ ok: true, profile });
  } catch (error) {
    next(error);
  }
}
