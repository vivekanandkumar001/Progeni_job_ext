import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { applicationService } from '../applicationService.js';
import { transitionStatus } from '../services/applicationEngine.js';

export async function listApplications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const applications = await applicationService.list(req.userId!);
    res.json({ ok: true, applications, isDemo: applications.length === 0 });
  } catch (error) {
    next(error);
  }
}

export async function getApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const application = await applicationService.get(req.params.id, req.userId!);
    if (!application) { res.status(404).json({ ok: false, error: 'Application not found' }); return; }
    res.json({ ok: true, application });
  } catch (error) {
    next(error);
  }
}

export async function createApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId, idempotencyKey, metadata } = req.body;
    const application = await applicationService.create(req.userId!, {
      jobId,
      idempotencyKey,
      status: 'discovered',
      metadata,
    });
    res.json({ ok: true, application });
  } catch (error) {
    next(error);
  }
}

export async function transitionApplication(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { to, metadata } = req.body;
    const result = await transitionStatus(
      applicationService.storage,
      req.params.id,
      to,
      req.userId!,
      metadata,
    );
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return; }
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
    if (!result.ok) { res.status(400).json({ ok: false, error: result.error }); return; }
    res.json({ ok: true, record: result.record });
  } catch (error) {
    next(error);
  }
}