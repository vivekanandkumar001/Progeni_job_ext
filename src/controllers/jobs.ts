import { NextFunction, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.js';
import { discoveryEngine } from '../services/discovery/discoveryEngine.js';
import { jobDiscoveryService } from '../services/jobDiscoveryService.js';
import { jobService } from '../services/jobService.js';

const jobCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().max(200).default('Unknown'),
  location: z.string().trim().max(200).nullable().optional(),
  salary_min: z.number().min(0).nullable().optional(),
  salary_max: z.number().min(0).nullable().optional(),
  experience_min: z.number().min(0).max(80).nullable().optional(),
  experience_max: z.number().min(0).max(80).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).nullable().optional(),
  mandatory_skills: z.array(z.string().trim().min(1).max(80)).max(100).nullable().optional(),
  source: z.string().trim().max(100).nullable().optional(),
  url: z.string().url().max(2048).nullable().optional(),
  platform: z.string().trim().max(100).nullable().optional(),
});

const jobImportSchema = z.object({
  url: z.string().url().max(2048).optional(),
  title: z.string().trim().max(300).optional(),
  companyName: z.string().trim().max(200).optional(),
  descriptionText: z.string().max(100000).optional(),
  descriptionHtml: z.string().max(200000).optional(),
  location: z.string().trim().max(200).optional(),
  workplaceMode: z.enum(['remote', 'hybrid', 'office']).optional(),
  salary: z.string().trim().max(200).optional(),
  provider: z.enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workday', 'manual', 'extension', 'other']).optional(),
  externalId: z.string().trim().max(200).optional(),
});

export async function listJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const location = typeof req.query.location === 'string' ? req.query.location : undefined;
    const workplace_mode = typeof req.query.workplace_mode === 'string' ? (req.query.workplace_mode as any) : undefined;
    const employment_type = typeof req.query.employment_type === 'string' ? (req.query.employment_type as any) : undefined;
    const min_salary = req.query.min_salary ? Number(req.query.min_salary) : undefined;
    const max_salary = req.query.max_salary ? Number(req.query.max_salary) : undefined;
    const provider = typeof req.query.provider === 'string' ? (req.query.provider as any) : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as any) : undefined;
    const personalized = req.query.personalized === 'true' || req.query.personalized === '1';
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await jobDiscoveryService.searchJobs(
      {
        q,
        role,
        location,
        workplace_mode,
        employment_type,
        min_salary,
        max_salary,
        provider,
        status,
        personalized,
        page,
        limit,
      },
      req.userId,
    );

    res.json({
      ok: true,
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      isPersonalized: result.isPersonalized,
      isDemo: result.jobs.length === 0,
    });
  } catch (error) {
    next(error);
  }
}

export async function getJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobDiscoveryService.getJobById(req.params.id, req.userId);
    if (!job) {
      res.status(404).json({ ok: false, error: 'Job not found' });
      return;
    }
    res.json({ ok: true, job });
  } catch (error) {
    next(error);
  }
}

export async function createJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = jobCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid job data', details: parsed.error.flatten() });
    return;
  }
  try {
    const job = await jobService.create(parsed.data);
    res.json({ ok: true, job });
  } catch (error) {
    next(error);
  }
}

export async function saveJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const saved = await jobDiscoveryService.saveJob(req.userId, req.params.id, req.body?.notes);
    res.json({ ok: true, saved });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      res.status(404).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
}

export async function unsaveJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const removed = await jobDiscoveryService.unsaveJob(req.userId, req.params.id);
    res.json({ ok: true, unsaved: removed });
  } catch (error) {
    next(error);
  }
}

export async function listSavedJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ ok: false, error: 'Authentication required' });
      return;
    }
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    const result = await jobDiscoveryService.listSavedJobs(req.userId, page, limit);
    res.json({ ok: true, saved_jobs: result.saved_jobs, total: result.total });
  } catch (error) {
    next(error);
  }
}

export async function importJob(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const parsed = jobImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid job import data', details: parsed.error.flatten() });
    return;
  }
  try {
    const userId = req.userId || 'system';
    const job = await jobDiscoveryService.importJob(userId, parsed.data, parsed.data.provider);
    res.json({ ok: true, job });
  } catch (error) {
    next(error);
  }
}

export async function discoverJobs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const metrics = await jobDiscoveryService.triggerDiscovery(req.body);
    res.json({ ok: true, metrics });
  } catch (error) {
    next(error);
  }
}

export async function getDiscoverySources(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sources = await discoveryEngine.listSources();
    res.json({ ok: true, sources });
  } catch (error) {
    next(error);
  }
}

export async function getDiscoveryStatus(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await jobDiscoveryService.getDiscoveryStatus();
    res.json({ ok: true, ...status });
  } catch (error) {
    next(error);
  }
}
