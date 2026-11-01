import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { matchService } from '../services/matchService.js';
import { calculateMatchScore, checkHardEligibility } from '../services/matchingEngine.js';

export async function listMatches(req: AuthRequest, res: Response): Promise<void> {
  try {
    const matches = await matchService.list(req.userId!);
    res.json({ ok: true, matches, isDemo: matches.length === 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function getMatch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const match = await matchService.get(req.params.id, req.userId!);
    if (!match) { res.status(404).json({ ok: false, error: 'Match not found' }); return; }
    res.json({ ok: true, match });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function calculateMatch(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { candidate, job, factors } = req.body;
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
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
}