import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.js';
import { resumeService } from '../services/resumeService.js';

export async function listResumes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const resumes = await resumeService.list(req.userId!);
    res.json({ ok: true, resumes, isDemo: resumes.length === 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function getResume(req: AuthRequest, res: Response): Promise<void> {
  try {
    const resume = await resumeService.get(req.params.id, req.userId!);
    if (!resume) { res.status(404).json({ ok: false, error: 'Resume not found' }); return; }
    res.json({ ok: true, resume });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
}

export async function upsertResume(req: AuthRequest, res: Response): Promise<void> {
  try {
    const resume = await resumeService.upsert(req.userId!, req.body);
    res.json({ ok: true, resume });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
}

export async function deleteResume(req: AuthRequest, res: Response): Promise<void> {
  try {
    await resumeService.delete(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
}