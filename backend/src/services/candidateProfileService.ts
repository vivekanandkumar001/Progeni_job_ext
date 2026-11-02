import { getDatabase } from '../config/mongodb.js';

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
    const collection = (await getDatabase()).collection<CandidateProfileRow & { _id: string }>(TABLE);
    const profile = await collection.findOne({ _id: userId, user_id: userId });
    return profile ? { ...profile, id: profile._id } : null;
  }

  async upsert(userId: string, body: Partial<CandidateProfileRow>): Promise<CandidateProfileRow> {
    const collection = (await getDatabase()).collection<CandidateProfileRow & { _id: string }>(TABLE);
    const existing = await collection.findOne(
      { _id: userId, user_id: userId },
      { projection: { created_at: 1 } },
    );
    const profile = {
      _id: userId,
      id: userId,
      user_id: userId,
      full_name: body.full_name || null,
      email: body.email || null,
      target_role: body.target_role || null,
      experience_level: body.experience_level || null,
      location: body.location || null,
      resume_completeness: typeof body.resume_completeness === 'number' ? body.resume_completeness : 0,
      skills: Array.isArray(body.skills) ? body.skills : null,
      experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await collection.replaceOne({ _id: userId }, profile, { upsert: true });
    return profile;
  }
}

export const candidateProfileService = new CandidateProfileService();