import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { applicationService } from '../applicationService.js';
import { transitionStatus } from '../services/applicationEngine.js';
import { applicationWorkspaceService } from '../services/assistant/applicationWorkspaceService.js';

const createApplicationSchema = z.object({
  jobId: z.string().trim().min(1).max(255).optional(),
  idempotencyKey: z.string().trim().max(128).optional(),
  customTone: z.enum(['professional', 'concise', 'technical', 'enthusiastic']).optional(),
  customInstructions: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateApplicationSchema = z.object({
  coverLetter: z
    .object({
      tone: z.enum(['professional', 'concise', 'technical', 'enthusiastic']).optional(),
      content: z.string().optional(),
      customInstructions: z.string().optional(),
    })
    .passthrough()
    .optional(),
  screeningAnswers: z.array(z.record(z.string(), z.unknown())).optional(),
  fieldMappings: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const transitionApplicationSchema = z.object({
  to: z.enum(['discovered', 'prepared', 'submitted', 'verified', 'failed']),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const generateResumeSchema = z.object({
  baseResumeId: z.string().trim().optional(),
});

const generateCoverLetterSchema = z.object({
  tone: z.enum(['professional', 'concise', 'technical', 'enthusiastic']).optional(),
  customInstructions: z.string().max(2000).optional(),
});

const generateAnswersSchema = z.object({
  questions: z.array(z.string().trim().min(1)).optional(),
});

const approveApplicationSchema = z.object({
  signature: z.string().trim().max(500).optional(),
});

const revokeApprovalSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

const exportBundleSchema = z.object({
  format: z.enum(['json', 'markdown', 'text']).optional().default('json'),
});

export async function listApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await applicationWorkspaceService.listWorkspaces(req.userId!, {
      q,
      status,
      page,
      limit,
    });

    res.json({
      ok: true,
      applications: result.applications,
      total: result.total,
      page: result.page,
      limit: result.limit,
      isDemo: result.applications.length === 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function getApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const workspace = await applicationWorkspaceService.getWorkspace(req.userId!, req.params.id);
    if (workspace) {
      res.json({ ok: true, application: workspace });
      return;
    }

    // Fallback to basic application record if not in full workspace format
    const application = await applicationService.get(req.params.id, req.userId!);
    if (!application) {
      res.status(404).json({ ok: false, error: 'Application not found' });
      return;
    }
    res.json({ ok: true, application });
  } catch (error) {
    next(error);
  }
}

export async function createApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = createApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid application request', details: parsed.error.flatten() });
    return;
  }
  try {
    const { jobId, idempotencyKey, customTone, customInstructions, metadata } = parsed.data;

    // Use full workspace creation if jobId is provided or create default workspace
    const workspace = await applicationWorkspaceService.createWorkspace(req.userId!, {
      jobId: jobId || '',
      idempotencyKey,
      customTone,
      customInstructions,
      metadata,
    });

    res.json({ ok: true, application: workspace });
  } catch (error) {
    next(error);
  }
}

export async function updateApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = updateApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid update payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await applicationWorkspaceService.updateWorkspace(
      req.userId!,
      req.params.id,
      parsed.data as any,
    );
    res.json({ ok: true, application: updated });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function generateResume(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = generateResumeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid resume generation options', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await applicationWorkspaceService.generateTailoredResume(
      req.userId!,
      req.params.id,
      parsed.data,
    );
    res.json({ ok: true, application: updated });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    res.status(400).json({ ok: false, error: error.message || 'Could not tailor resume' });
  }
}

export async function generateCoverLetter(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = generateCoverLetterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid cover letter options', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await applicationWorkspaceService.generateCoverLetter(
      req.userId!,
      req.params.id,
      parsed.data,
    );
    res.json({ ok: true, application: updated });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function generateAnswers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = generateAnswersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid questions payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await applicationWorkspaceService.generateScreeningAnswers(
      req.userId!,
      req.params.id,
      parsed.data.questions,
    );
    res.json({ ok: true, application: updated });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function approveApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = approveApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid approval payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const ip = req.ip || req.socket.remoteAddress;
    const updated = await applicationWorkspaceService.approveApplication(
      req.userId!,
      req.params.id,
      { signature: parsed.data.signature, ip },
    );
    res.json({ ok: true, application: updated, message: 'Application explicitly approved for submission' });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function revokeApproval(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = revokeApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid revocation payload', details: parsed.error.flatten() });
    return;
  }
  try {
    const updated = await applicationWorkspaceService.revokeApproval(
      req.userId!,
      req.params.id,
      parsed.data.reason,
    );
    res.json({ ok: true, application: updated, message: 'Application approval revoked' });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function exportApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = exportBundleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid export format', details: parsed.error.flatten() });
    return;
  }
  try {
    const result = await applicationWorkspaceService.exportBundle(
      req.userId!,
      req.params.id,
      parsed.data.format,
    );
    res.json({
      ok: true,
      filename: result.filename,
      format: result.format,
      content: result.content,
      bundle: result.bundle,
    });
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('access denied')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function transitionApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = transitionApplicationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid transition request', details: parsed.error.flatten() });
    return;
  }
  try {
    const { to, metadata } = parsed.data;
    const result = await transitionStatus(
      applicationService.storage,
      req.params.id,
      to,
      req.userId!,
      metadata,
    );
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, record: result.record });
  } catch (error) {
    next(error);
  }
}

export async function reconcileApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await transitionStatus(
      applicationService.storage,
      req.params.id,
      'failed',
      req.userId!,
      {
        failureReason: 'Unknown outcome reconciled after restart',
        reconciledAt: new Date().toISOString(),
      },
    );
    if (!result.ok) {
      res.status(400).json({ ok: false, error: result.error });
      return;
    }
    res.json({ ok: true, record: result.record });
  } catch (error) {
    next(error);
  }
}
