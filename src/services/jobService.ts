import { randomUUID } from 'node:crypto';
import { getDatabase } from '../config/mongodb.js';

const TABLE = 'jobs';

export interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  experience_min: number | null;
  experience_max: number | null;
  skills: string[] | null;
  mandatory_skills: string[] | null;
  source: string | null;
  url: string | null;
  platform: string | null;
  created_at: string;
}

type JobDocument = Omit<JobRow, 'id'> & { _id: string };

export class JobService {
  async list(): Promise<JobRow[]> {
    const jobs = await (await getDatabase())
      .collection<JobDocument>(TABLE)
      .find({})
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    return jobs.map((job) => this.toRow(job));
  }

  async get(id: string): Promise<JobRow | null> {
    const job = await (await getDatabase()).collection<JobDocument>(TABLE).findOne({ _id: id });
    return job ? this.toRow(job) : null;
  }

  async create(body: Partial<JobRow>): Promise<JobRow> {
    const job: JobDocument = {
      _id: randomUUID(),
      title: body.title || 'Untitled',
      company: body.company || 'Unknown',
      location: body.location || null,
      salary_min: typeof body.salary_min === 'number' ? body.salary_min : null,
      salary_max: typeof body.salary_max === 'number' ? body.salary_max : null,
      experience_min: typeof body.experience_min === 'number' ? body.experience_min : null,
      experience_max: typeof body.experience_max === 'number' ? body.experience_max : null,
      skills: Array.isArray(body.skills) ? body.skills : null,
      mandatory_skills: Array.isArray(body.mandatory_skills) ? body.mandatory_skills : null,
      source: body.source || null,
      url: body.url || null,
      platform: body.platform || null,
      created_at: new Date().toISOString(),
    };
    await (await getDatabase()).collection<JobDocument>(TABLE).insertOne(job);
    return this.toRow(job);
  }

  private toRow(job: JobDocument): JobRow {
    const { _id, ...data } = job;
    return { ...data, id: _id };
  }
}

export const jobService = new JobService();