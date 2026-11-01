import { supabase } from '../config/supabase/client.js';

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

export class JobService {
  async list(): Promise<JobRow[]> {
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw new Error('Failed to list jobs: ' + error.message);
    return data || [];
  }

  async get(id: string): Promise<JobRow | null> {
    const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('Failed to fetch job: ' + error.message);
    return data || null;
  }

  async create(body: Partial<JobRow>): Promise<JobRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
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
      })
      .select()
      .single();
    if (error) throw new Error('Failed to create job: ' + error.message);
    return data;
  }
}

export const jobService = new JobService();