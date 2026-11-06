import { getDatabase } from '../config/mongodb.js';

const TABLE = 'candidate_profiles';

export interface CandidateEducation {
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface CandidateWorkExperience {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  highlights?: string[];
}

export interface CandidateProject {
  name: string;
  description?: string;
  url?: string;
  technologies?: string[];
}

export interface CandidateCertification {
  name: string;
  issuer?: string;
  issueDate?: string;
}

export interface CandidateProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  target_role: string | null;
  experience_level: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  resume_completeness: number;
  skills: string[] | null;
  experience_years: number | null;
  education?: CandidateEducation[] | null;
  work_experience?: CandidateWorkExperience[] | null;
  projects?: CandidateProject[] | null;
  certifications?: CandidateCertification[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileCompletenessResult {
  score: number; // 0-100
  completedFields: string[];
  missingFields: string[];
}

export class CandidateProfileService {
  async get(userId: string): Promise<CandidateProfileRow | null> {
    const collection = (await getDatabase()).collection<CandidateProfileRow & { _id: string }>(TABLE);
    const profile = await collection.findOne({ _id: userId as any, user_id: userId });
    return profile ? { ...profile, id: profile._id } : null;
  }

  calculateCompleteness(profile: CandidateProfileRow | null): ProfileCompletenessResult {
    if (!profile) {
      return {
        score: 0,
        completedFields: [],
        missingFields: [
          'Full Name',
          'Email Address',
          'Phone Number',
          'Location (City & Country)',
          'Target Role',
          'Professional Links',
          'Skills',
          'Years of Experience',
        ],
      };
    }

    const checks: Array<{ label: string; pass: boolean; weight: number }> = [
      { label: 'Full Name', pass: Boolean(profile.full_name && profile.full_name.trim().length > 0), weight: 15 },
      { label: 'Email Address', pass: Boolean(profile.email && profile.email.trim().length > 0), weight: 15 },
      { label: 'Phone Number', pass: Boolean(profile.phone && profile.phone.trim().length > 0), weight: 10 },
      {
        label: 'Location (City & Country)',
        pass: Boolean((profile.city && profile.country) || (profile.location && profile.location.trim().length > 0)),
        weight: 10,
      },
      { label: 'Target Role', pass: Boolean(profile.target_role && profile.target_role.trim().length > 0), weight: 15 },
      {
        label: 'Professional Links',
        pass: Boolean(profile.linkedin_url || profile.github_url || profile.portfolio_url),
        weight: 10,
      },
      {
        label: 'Skills',
        pass: Boolean(Array.isArray(profile.skills) && profile.skills.length >= 1),
        weight: 15,
      },
      {
        label: 'Years of Experience',
        pass: typeof profile.experience_years === 'number' && profile.experience_years >= 0,
        weight: 10,
      },
    ];

    const completedFields: string[] = [];
    const missingFields: string[] = [];
    let score = 0;

    for (const check of checks) {
      if (check.pass) {
        completedFields.push(check.label);
        score += check.weight;
      } else {
        missingFields.push(check.label);
      }
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      completedFields,
      missingFields,
    };
  }

  async upsert(userId: string, body: Partial<CandidateProfileRow>): Promise<CandidateProfileRow> {
    const collection = (await getDatabase()).collection<CandidateProfileRow & { _id: string }>(TABLE);
    const existing = await collection.findOne(
      { _id: userId as any, user_id: userId },
      { projection: { created_at: 1 } },
    );

    const fullProfile: CandidateProfileRow = {
      id: userId,
      user_id: userId,
      full_name: body.full_name ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      target_role: body.target_role ?? null,
      experience_level: body.experience_level ?? null,
      location: body.location ?? (body.city && body.country ? `${body.city}, ${body.country}` : null),
      linkedin_url: body.linkedin_url ?? null,
      github_url: body.github_url ?? null,
      portfolio_url: body.portfolio_url ?? null,
      resume_completeness: 0,
      skills: Array.isArray(body.skills) ? body.skills : null,
      experience_years: typeof body.experience_years === 'number' ? body.experience_years : null,
      education: Array.isArray(body.education) ? body.education : null,
      work_experience: Array.isArray(body.work_experience) ? body.work_experience : null,
      projects: Array.isArray(body.projects) ? body.projects : null,
      certifications: Array.isArray(body.certifications) ? body.certifications : null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    fullProfile.resume_completeness = this.calculateCompleteness(fullProfile).score;

    const mongoDoc = {
      _id: userId,
      ...fullProfile,
    };

    await collection.replaceOne({ _id: userId as any }, mongoDoc as any, { upsert: true });

    // Synchronize to candidate_workspaces for backwards compatibility
    await this.syncToWorkspace(userId, fullProfile);

    return fullProfile;
  }

  async patch(userId: string, body: Partial<CandidateProfileRow>): Promise<CandidateProfileRow> {
    const existing = await this.get(userId);
    const merged: Partial<CandidateProfileRow> = {
      ...(existing || {}),
      ...body,
    };
    return this.upsert(userId, merged);
  }

  private async syncToWorkspace(userId: string, profile: CandidateProfileRow): Promise<void> {
    try {
      const db = await getDatabase();
      const workspaceCollection = db.collection('candidate_workspaces');
      await workspaceCollection.updateOne(
        { _id: userId as any },
        {
          $set: {
            'data.profile': {
              fullName: profile.full_name || '',
              email: profile.email || '',
              phone: profile.phone || '',
              targetRole: profile.target_role || '',
              location: profile.location || '',
              skills: profile.skills || [],
              experienceYears: profile.experience_years,
              updatedAt: profile.updated_at,
            },
          },
        },
        { upsert: false },
      );
    } catch {
      // Non-blocking sync error
    }
  }
}

export const candidateProfileService = new CandidateProfileService();
