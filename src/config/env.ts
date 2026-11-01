import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const localJwtSecret = 'local-development-secret-do-not-use-outside-local';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(16).default(localJwtSecret),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid environment configuration in production');
  }
}

export const env = parsed.success ? parsed.data : {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || localJwtSecret,
};

if (
  env.NODE_ENV === 'production' &&
  (env.JWT_SECRET === localJwtSecret || env.JWT_SECRET.length < 32 || !env.SUPABASE_URL)
) {
  throw new Error('Production requires Supabase configuration and a unique JWT_SECRET of at least 32 characters.');
}

export const isLocalDevelopment = env.NODE_ENV === 'development' && !env.SUPABASE_URL;