import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { interviewService } from '../services/tracker/interviewService.js';
import type { InterviewStage, InterviewMode, InterviewStatus } from '../services/tracker/types.js';

const interviewStageEnum = z.enum([
  'hr_screening',
  'technical_interview',
  'coding_assessment',
  'managerial_interview',
  'final_interview',
  'other',
]);

const interviewModeEnum = z.enum(['video', 'phone', 'in_person', 'take_home']);
const interviewStatusEnum = z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']);

const interviewerDetailsSchema = z.object({
  name: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  email: z.string().email().optional(),
  linkedin: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  strengths: z.array(z.string()).optional(),
  areasToImprove: z.array(z.string()).optional(),
  questionsAsked: z.array(z.string()).optional(),
  overallImpression: z.string().max(2000).optional(),
});

const createInterviewSchema = z.object({
  applicationId: z.string().min(1),
  stage: interviewStageEnum,
  scheduledAt: z.string().min(1),
  timezone: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  interviewMode: interviewModeEnum,
  meetingLink: z.string().max(1000).optional(),
  location: z.string().max(500).optional(),
  interviewerDetails: interviewerDetailsSchema.optional(),
  preparationNotes: z.string().max(3000).optional(),
});

const updateInterviewSchema = z.object({
  stage: interviewStageEnum.optional(),
  scheduledAt: z.string().optional(),
  timezone: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  interviewMode: interviewModeEnum.optional(),
  meetingLink: z.string().max(1000).optional(),
  location: z.string().max(500).optional(),
  interviewerDetails: interviewerDetailsSchema.optional(),
  preparationNotes: z.string().max(3000).optional(),
  status: interviewStatusEnum.optional(),
  feedback: feedbackSchema.optional(),
  nextSteps: z.string().max(1000).optional(),
});

export async function createInterview(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = createInterviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid interview parameters', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const record = await interviewService.createInterview(candidateId, parsed.data);
    res.status(201).json({ ok: true, interview: record });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function listInterviews(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const applicationId = typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as InterviewStatus) : undefined;
    const stage = typeof req.query.stage === 'string' ? (req.query.stage as InterviewStage) : undefined;

    const interviews = await interviewService.listInterviews(candidateId, {
      applicationId,
      status,
      stage,
    });

    res.json({ ok: true, interviews });
  } catch (error) {
    next(error);
  }
}

export async function getInterview(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const interview = await interviewService.getInterview(candidateId, req.params.id);

    if (!interview) {
      res.status(404).json({ ok: false, error: 'Interview not found' });
      return;
    }

    res.json({ ok: true, interview });
  } catch (error) {
    next(error);
  }
}

export async function updateInterview(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = updateInterviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid update parameters', details: parsed.error.flatten() });
    return;
  }

  try {
    const candidateId = req.userId!;
    const updated = await interviewService.updateInterview(candidateId, req.params.id, parsed.data);

    if (!updated) {
      res.status(404).json({ ok: false, error: 'Interview not found' });
      return;
    }

    res.json({ ok: true, interview: updated });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

export async function deleteInterview(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidateId = req.userId!;
    const deleted = await interviewService.deleteInterview(candidateId, req.params.id);

    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Interview not found' });
      return;
    }

    res.json({ ok: true, message: 'Interview deleted successfully' });
  } catch (error) {
    next(error);
  }
}

