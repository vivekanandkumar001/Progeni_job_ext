import { supabase } from '../config/supabase/client.js';

const TABLE = 'resumes';

export interface ResumeRow {
  id: string;
  user_id: string;
  title: string;
  file_name: string | null;
  file_url: string | null;
  file_type: string | null;
  parsed_text: string | null;
  skills: string[] | null;
  experience_years: number | null;
  sections: Record<string, unknown> | null;
  ats_score: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class ResumeService {
  async list(userId: string): Promise<ResumeRow[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Failed to list resumes: ' + error.message);
    return data || [];
  }

  async get(id: string, userId: string): Promise<ResumeRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('Failed to fetch resume: ' + error.message);
    return data || null;
  }

  async upsert(userId: string, body: Partial<ResumeRow>): Promise<ResumeRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({
        user_id: userId,
        title: body.title || 'Untitled Resume',
        file_name: body.file_name || null,
        file_url: body.file_url || null,
        file_type: body.file_type || null,
        parsed_text: body.parsed_text || null,
        skills: Array.isArray(body.skills) ? body.skills : null,
        experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
        sections: body.sections || null,
        ats_score: typeof body.ats_score === 'number' ? body.ats_score : null,
        is_active: body.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error('Failed to upsert resume: ' + error.message);
    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw new Error('Failed to delete resume: ' + error.message);
  }
}

export const resumeService = new ResumeService();