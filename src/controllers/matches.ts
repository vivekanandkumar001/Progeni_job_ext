import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { matchService } from '../services/matchService.js';
import { calculateMatchScore, checkHardEligibility } from '../services/matchingEngine.js';

const matchCalculateSchema = z.object({
  candidate: z.record(z.string(), z.unknown()).optional().default({}),
  job: z
    .object({
      id: z.string().optional(),
      mandatorySkills: z.array(z.string().trim().min(1).max(80)).optional(),
      mandatory_skills: z.array(z.string().trim().min(1).max(80)).optional(),
      experienceMin: z.number().min(0).max(80).optional(),
      experience_min: z.number().min(0).max(80).optional(),
    })
    .passthrough()
    .optional()
    .default({}),
  factors: z.record(z.string(), z.number().min(0).max(100)).optional().default({}),
});

export async function listMatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const sort = req.query.sort as any;
    const eligibility_status = req.query.eligibility_status as any;
    const min_score = req.query.min_score ? Number(req.query.min_score) : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await matchService.list(req.userId, {
      sort,
      eligibility_status,
      min_score,
      page,
      limit,
    });

    res.json({
      ok: true,
      matches: result.matches,
      total: result.total,
      isDemo: result.matches.length === 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMatch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const match = await matchService.get(req.params.id, req.userId);
    if (!match) {
      res.status(404).json({ ok: false, error: 'Match not found' });
      return;
    }
    res.json({ ok: true, match });
  } catch (error) {
    next(error);
  }
}

export async function recalculateMatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const matches = await matchService.recalculateMatches(req.userId, req.body);
    res.json({ ok: true, matches, count: matches.length });
  } catch (error) {
    next(error);
  }
}

export async function getMatchSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const summary = await matchService.getSummary(req.userId);
    res.json({ ok: true, summary });
  } catch (error) {
    next(error);
  }
}

export async function getSkillGaps(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const skillGaps = await matchService.getSkillGaps(req.userId);
    res.json({ ok: true, ...skillGaps });
  } catch (error) {
    next(error);
  }
}

export async function calculateMatch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = matchCalculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid match calculation request', details: parsed.error.flatten() });
    return;
  }
  try {
    const { candidate, job, factors } = parsed.data;
    const scoreResult = calculateMatchScore(factors || {});
    const eligibility = checkHardEligibility(candidate || {}, job || {});
    const match = await matchService.create(req.userId!, {
      jobId: job?.id,
      score: scoreResult.score,
      factors: scoreResult.factors,
      explanation: scoreResult.explanation,
      missingEvidence: scoreResult.missingEvidence,
      eligible: eligibility.eligible,
      blockers: eligibility.blockers,
      unknowns: eligibility.unknowns,
      evidence: eligibility.evidence,
    });
    res.json({ ok: true, match, score: scoreResult, eligibility });
  } catch (error) {
    next(error);
  }
}
