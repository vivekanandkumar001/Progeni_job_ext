import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { candidateProfileService } from '../services/candidateProfileService.js';

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const profile = await candidateProfileService.get(req.userId!);
    res.json({ ok: true, profile: profile || null, isDemo: !profile });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function upsertProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const profile = await candidateProfileService.upsert(req.userId!, req.body);
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
}