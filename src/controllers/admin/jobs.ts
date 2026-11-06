import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';

export interface Job {
  id: string;
  title: string;
  company: string;
  platform: string;
  url: string;
  status: string;
  matchScore?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get all jobs with filtering
 */
export async function getAllJobs(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt((req as any).query.page as string) || 1;
    const limit = parseInt((req as any).query.limit as string) || 50;
    const status = (req as any).query.status as string;

    const db = await getDatabase();
    const jobsCol = db.collection('jobs');

    const filter: any = {};
    if (status) filter.status = status;

    const total = await jobsCol.countDocuments(filter);
    const jobs = await jobsCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .project({
        id: { $toString: '$_id' },
        title: 1,
        company: 1,
        platform: 1,
        url: 1,
        status: 1,
        matchScore: 1,
        createdAt: 1,
      })
      .toArray();

    res.json({
      success: true,
      data: jobs.map((j: any) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        platform: j.platform,
        url: j.url,
        status: j.status,
        matchScore: j.matchScore,
        createdAt: j.createdAt,
      })),
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single job details
 */
export async function getJobById(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const jobsCol = db.collection('jobs');
    const job = await jobsCol.findOne({ _id: req.params.id });
    
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: job._id,
        title: job.title,
        company: job.company,
        platform: job.platform,
        url: job.url,
        status: job.status,
        matchScore: job.matchScore,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const db = await getDatabase();
    const jobsCol = db.collection('jobs');
    
    const result = await jobsCol.updateOne(
      { _id: req.params.id },
      { 
        $set: { status: status, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    const updatedJob = await jobsCol.findOne({ _id: req.params.id });
    res.json({
      success: true,
      data: {
        id: updatedJob._id,
        title: updatedJob.title,
        company: updatedJob.company,
        platform: updatedJob.platform,
        status: updatedJob.status,
        updatedAt: updatedJob.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete job
 */
export async function deleteJob(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const jobsCol = db.collection('jobs');
    
    const result = await jobsCol.deleteOne({ _id: req.params.id });
    
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    res.json({
      success: true,
      data: { message: 'Job permanently deleted' },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}