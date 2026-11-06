import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { trackerService } from '../services/tracker/trackerService.js';
import { submissionEvidenceService } from '../services/tracker/submissionEvidenceService.js';
import { trackerTimelineService } from '../services/tracker/trackerTimelineService.js';
import type { ApplicationLifecycleStatus } from '../services/tracker/types.js';

const updateStatusSchema = z.object({
  status: z.enum([
    'discovered',
    'preparing',
    'ready_for_review',
    'approved',
    'submitted',
    'under_review',
    'shortlisted',
    'interview_scheduled',
    'rejected',
    'offer_received',
    'offer_accepted',
    'offer_declined',
    'withdrawn',
    'closed',
  ]),
  reason: z.string().max(1000).optional(),
});

const submissionEvidenceSchema = z.object({
  jobId: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  destination: z.string().min(1).max(2000),
  submissionMethod: z.enum(['manual', 'extension_assisted', 'direct_api', 'portal']),
  confirmationReference: z.string().max(255).optional(),
  confirmationEvidence: z
    .object({
      type: z.enum(['email_snippet', 'screenshot_url', 'portal_confirmation_url', 'confirmation_text']),
      value: z.string().min(1).max(10000),
      submittedAt: z.string(),
    })
    .optional(),
  verificationStatus: z.enum(['verified', 'candidate_reported', 'unverified']).optional(),
  notes: z.string().max(2000).optional(),
});

export async function listTrackedApplications(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const company = typeof req.query.company === 'string' ? req.query.company : undefined;
    const title = typeof req.query.title === 'string' ? req.query.title : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined;
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await trackerService.listTrackedApplications(candidateId, {
      q,
      company,
      title,
      status,
      source,
      fromDate,
      toDate,
      page,
      limit,
    });

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getApplicationDossier(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const applicationId = req.params.id;

    const dossier = await trackerService.getApplicationDossier(candidateId, applicationId);
    if (!dossier) {
      res.status(404).json({ ok: false, error: 'Application not found' });
      return;
    }

    res.json({ ok: true, dossier });
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid status update', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const applicationId = req.params.id;
    const { status, reason } = parsed.data;

    const result = await trackerService.updateStatus(
      candidateId,
      applicationId,
      status as ApplicationLifecycleStatus,
      reason,
    );

    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function recordSubmissionEvidence(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = submissionEvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid submission evidence', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const applicationId = req.params.id;

    const record = await submissionEvidenceService.recordSubmissionEvidence(
      candidateId,
      applicationId,
      parsed.data,
    );

    res.status(201).json({ ok: true, evidence: record });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function getApplicationTimeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const applicationId = req.params.id;

    const timeline = await trackerTimelineService.getTimeline(candidateId, applicationId);
    res.json({ ok: true, timeline });
  } catch (error) {
    next(error);
  }
}

