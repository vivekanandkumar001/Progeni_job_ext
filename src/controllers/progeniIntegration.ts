import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { progeniIntegrationService } from '../services/integration/progeniIntegrationService.js';

const launchSchema = z.object({
  applicationId: z.string().min(1, 'Application ID is required'),
  interviewId: z.string().optional(),
  customRole: z.string().max(200).optional(),
  customJd: z.string().max(10000).optional(),
});

export async function launchProgeniSession(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = launchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid launch parameters', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const result = await progeniIntegrationService.launchInterviewSession(candidateId, parsed.data);
    res.status(201).json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function syncProgeniSession(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const sessionId = req.params.sessionId;

    const simulation = await progeniIntegrationService.syncInterviewResult(candidateId, sessionId);
    res.json({ ok: true, simulation });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function listProgeniSessions(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const applicationId = typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;

    const simulations = await progeniIntegrationService.listCandidateSimulations(candidateId, applicationId);
    res.json({ ok: true, simulations });
  } catch (error) {
    next(error);
  }
}

export async function handleProgeniWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const signature = req.headers['x-progeni-signature'];
    const rawBody = JSON.stringify(req.body);

    if (
      typeof signature !== 'string' ||
      !progeniIntegrationService.verifyWebhookSignature(rawBody, signature)
    ) {
      res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
      return;
    }

    const { event, sessionId, candidateId } = req.body;
    if (event === 'interview_completed' && sessionId && candidateId) {
      await progeniIntegrationService.syncInterviewResult(candidateId, sessionId);
    }

    res.json({ ok: true, received: true });
  } catch (error) {
    next(error);
  }
}

