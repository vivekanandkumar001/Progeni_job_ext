import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { followUpService } from '../services/tracker/followUpService.js';
import type { FollowUpStatus } from '../services/tracker/types.js';

const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  reminderDate: z.string().optional(),
  notificationChannel: z.enum(['in_app', 'email']).optional(),
});

const contactDetailsSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  role: z.string().max(200).optional(),
});

const createFollowUpSchema = z.object({
  applicationId: z.string().min(1),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  nextAction: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  reminderSettings: reminderSettingsSchema.optional(),
  contactDetails: contactDetailsSchema.optional(),
});

const updateFollowUpSchema = z.object({
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
  nextAction: z.string().min(1).max(500).optional(),
  notes: z.string().max(2000).optional(),
  reminderSettings: reminderSettingsSchema.optional(),
  contactDetails: contactDetailsSchema.optional(),
});

const logActionSchema = z.object({
  action: z.string().min(1).max(500),
  notes: z.string().max(2000).optional(),
  markCompleted: z.boolean().optional(),
  nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
});

export async function createFollowUp(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = createFollowUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid follow-up parameters', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const followUp = await followUpService.createFollowUp(candidateId, parsed.data);
    res.status(201).json({ ok: true, followUp });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function listFollowUps(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const applicationId = typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as FollowUpStatus) : undefined;
    const overdueOnly = req.query.overdueOnly === 'true';

    const followUps = await followUpService.listFollowUps(candidateId, {
      applicationId,
      status,
      overdueOnly,
    });

    res.json({ ok: true, followUps });
  } catch (error) {
    next(error);
  }
}

export async function getFollowUp(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const followUp = await followUpService.getFollowUp(candidateId, req.params.id);

    if (!followUp) {
      res.status(404).json({ ok: false, error: 'Follow-up not found' });
      return;
    }

    res.json({ ok: true, followUp });
  } catch (error) {
    next(error);
  }
}

export async function updateFollowUp(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = updateFollowUpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid update parameters', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const updated = await followUpService.updateFollowUp(candidateId, req.params.id, parsed.data);

    if (!updated) {
      res.status(404).json({ ok: false, error: 'Follow-up not found' });
      return;
    }

    res.json({ ok: true, followUp: updated });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function logFollowUpAction(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = logActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid action payload', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const updated = await followUpService.logFollowUpAction(candidateId, req.params.id, parsed.data);

    if (!updated) {
      res.status(404).json({ ok: false, error: 'Follow-up not found' });
      return;
    }

    res.json({ ok: true, followUp: updated });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

