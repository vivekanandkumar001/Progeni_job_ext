import { supabase } from '../config/supabase/client.js';

const TABLE = 'candidate_profiles';

export interface CandidateProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  target_role: string | null;
  experience_level: string | null;
  location: string | null;
  resume_completeness: number;
  skills: string[] | null;
  experience_years: number | null;
  created_at: string;
  updated_at: string;
}

export class CandidateProfileService {
  async get(userId: string): Promise<CandidateProfileRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error('Failed to fetch profile: ' + error.message);
    return data || null;
  }

  async upsert(userId: string, body: Partial<CandidateProfileRow>): Promise<CandidateProfileRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({
        user_id: userId,
        full_name: body.full_name || null,
        email: body.email || null,
        target_role: body.target_role || null,
        experience_level: body.experience_level || null,
        location: body.location || null,
        resume_completeness: typeof body.resume_completeness === 'number' ? body.resume_completeness : 0,
        skills: Array.isArray(body.skills) ? body.skills : null,
        experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error('Failed to upsert profile: ' + error.message);
    return data;
  }
}

export const candidateProfileService = new CandidateProfileService();