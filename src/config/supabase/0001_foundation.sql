CREATE EXTENSION IF NOT EXISTS uuid-ossp;

CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,
  full_name TEXT,
  email TEXT,
  target_role TEXT,
  experience_level TEXT,
  location TEXT,
  resume_completeness INTEGER DEFAULT 0,
  skills TEXT[],
  experience_years NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  file_name TEXT,
  file_url TEXT,
  file_type TEXT,
  parsed_text TEXT,
  skills TEXT[],
  experience_years NUMERIC,
  ats_score INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  salary_min NUMERIC,
  salary_max NUMERIC,
  experience_min NUMERIC,
  experience_max NUMERIC,
  skills TEXT[],
  mandatory_skills TEXT[],
  source TEXT,
  url TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  job_id UUID,
  score NUMERIC NOT NULL,
  factors JSONB,
  explanation TEXT[],
  missing_evidence TEXT[],
  eligible BOOLEAN DEFAULT FALSE,
  blockers TEXT[],
  unknowns TEXT[],
  evidence TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  job_id UUID,
  status TEXT DEFAULT 'discovered',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS site_adapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_id TEXT UNIQUE,
  policy_state TEXT DEFAULT 'manual_only',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_user_id ON candidate_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_user_id ON job_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_job_matches_score ON job_matches(score DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_idempotency ON applications(idempotency_key);