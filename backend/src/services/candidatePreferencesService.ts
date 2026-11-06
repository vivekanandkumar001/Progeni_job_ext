import { getDatabase } from '../config/mongodb.js';

const TABLE = 'candidate_preferences';

export type WorkplaceType = 'remote' | 'hybrid' | 'office' | 'any';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
export type JoiningAvailability = 'immediate' | '15_days' | '30_days' | '60_days' | '90_days';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export interface ExpectedSalary {
  currency: string;
  min: number | null;
  max: number | null;
  period: 'yearly' | 'monthly';
}

export interface CandidatePreferencesRow {
  id: string;
  user_id: string;
  desired_roles: string[];
  preferred_locations: string[];
  workplace_type: WorkplaceType;
  expected_salary: ExpectedSalary;
  experience_level: ExperienceLevel;
  joining_availability: JoiningAvailability;
  employment_type: EmploymentType;
  created_at: string;
  updated_at: string;
}

export const defaultPreferences: Omit<CandidatePreferencesRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  desired_roles: [],
  preferred_locations: [],
  workplace_type: 'remote',
  expected_salary: {
    currency: 'INR',
    min: null,
    max: null,
    period: 'yearly',
  },
  experience_level: 'mid',
  joining_availability: 'immediate',
  employment_type: 'full-time',
};

export class CandidatePreferencesService {
  async get(userId: string): Promise<CandidatePreferencesRow | null> {
    const collection = (await getDatabase()).collection<CandidatePreferencesRow & { _id: string }>(TABLE);
    const row = await collection.findOne({ _id: userId, user_id: userId });
    return row ? { ...row, id: row._id } : null;
  }

  async upsert(userId: string, body: Partial<CandidatePreferencesRow>): Promise<CandidatePreferencesRow> {
    const collection = (await getDatabase()).collection<CandidatePreferencesRow & { _id: string }>(TABLE);
    const existing = await collection.findOne(
      { _id: userId as any, user_id: userId },
      { projection: { created_at: 1 } },
    );

    const preferences: CandidatePreferencesRow = {
      id: userId,
      user_id: userId,
      desired_roles: Array.isArray(body.desired_roles) ? body.desired_roles : [],
      preferred_locations: Array.isArray(body.preferred_locations) ? body.preferred_locations : [],
      workplace_type: body.workplace_type || 'remote',
      expected_salary: {
        currency: body.expected_salary?.currency || 'INR',
        min: typeof body.expected_salary?.min === 'number' ? body.expected_salary.min : null,
        max: typeof body.expected_salary?.max === 'number' ? body.expected_salary.max : null,
        period: body.expected_salary?.period || 'yearly',
      },
      experience_level: body.experience_level || 'mid',
      joining_availability: body.joining_availability || 'immediate',
      employment_type: body.employment_type || 'full-time',
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const doc: any = { _id: userId, ...preferences };
    await collection.replaceOne({ _id: userId as any }, doc, { upsert: true });
    return preferences;
  }

  async patch(
    userId: string,
    body: Partial<Omit<CandidatePreferencesRow, 'expected_salary'>> & {
      expected_salary?: Partial<ExpectedSalary>;
    },
  ): Promise<CandidatePreferencesRow> {
    const existing = await this.get(userId);
    const merged: Partial<CandidatePreferencesRow> = {
      ...(existing || defaultPreferences),
      ...body,
      expected_salary: {
        ...(existing?.expected_salary || defaultPreferences.expected_salary),
        ...(body.expected_salary || {}),
        currency: body.expected_salary?.currency || existing?.expected_salary?.currency || defaultPreferences.expected_salary.currency,
        period: body.expected_salary?.period || existing?.expected_salary?.period || defaultPreferences.expected_salary.period,
      },
    };
    return this.upsert(userId, merged);
  }
}

export const candidatePreferencesService = new CandidatePreferencesService();
