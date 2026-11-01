import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { jobService } from '../services/jobService.js';

export async function listJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const jobs = await jobService.list();
    res.json({ ok: true, jobs, isDemo: jobs.length === 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function getJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const job = await jobService.get(req.params.id);
    if (!job) { res.status(404).json({ ok: false, error: 'Job not found' }); return; }
    res.json({ ok: true, job });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const job = await jobService.create(req.body);
    res.json({ ok: true, job });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
}