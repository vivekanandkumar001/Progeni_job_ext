import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { candidateProfileService } from '../services/candidateProfileService.js';

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await candidateProfileService.get(req.userId!);
    res.json({ ok: true, profile: profile || null, isDemo: !profile });
  } catch (error) {
    next(error);
  }
}

export async function upsertProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await candidateProfileService.upsert(req.userId!, req.body);
    res.json({ ok: true, profile });
  } catch (error) {
    next(error);
  }
}