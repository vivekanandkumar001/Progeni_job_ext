import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { analyticsService } from '../services/tracker/analyticsService.js';

export async function getApplicationAnalytics(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const analytics = await analyticsService.calculateApplicationAnalytics(candidateId);
    res.json({ ok: true, analytics });
  } catch (error) {
    next(error);
  }
}

