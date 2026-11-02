import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const localJwtSecret = 'local-development-secret-do-not-use-outside-local';

function isValidOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      parsed.origin === origin &&
      ['http:', 'https:', 'chrome-extension:'].includes(parsed.protocol)
    );
  } catch {
    return false;
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  MONGODB_URI: z.string().optional().refine(
    (value) => !value || value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'),
    'MONGODB_URI must be a MongoDB connection string.',
  ),
  MONGODB_DB: z.string().default('progeni_autoapply'),
  CORS_ALLOWED_ORIGINS: z.string().default('').transform((value) =>
    value.split(',').map((origin) => origin.trim()).filter(Boolean),
  ).refine((origins) => origins.every(isValidOrigin), 'Every CORS origin must be an exact HTTP(S) or Chrome extension origin.'),
  JWT_SECRET: z.string().min(16).default(localJwtSecret),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Invalid environment configuration in production');
  }
}

export const env: z.infer<typeof EnvSchema> = parsed.success ? parsed.data : {
  NODE_ENV: process.env.NODE_ENV === 'production'
    ? 'production'
    : process.env.NODE_ENV === 'test'
      ? 'test'
      : 'development',
  PORT: process.env.PORT || '5000',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  MONGODB_URI: process.env.MONGODB_URI || '',
  MONGODB_DB: process.env.MONGODB_DB || 'progeni_autoapply',
  CORS_ALLOWED_ORIGINS: [],
  JWT_SECRET: process.env.JWT_SECRET || localJwtSecret,
};

if (
  env.NODE_ENV === 'production' &&
  (!env.SUPABASE_URL ||
    !env.SUPABASE_URL.startsWith('https://') ||
    !env.SUPABASE_ANON_KEY ||
    !env.MONGODB_URI ||
    env.CORS_ALLOWED_ORIGINS.length === 0 ||
    env.CORS_ALLOWED_ORIGINS.some(
      (origin) => !origin.startsWith('https://') && !origin.startsWith('chrome-extension://'),
    ))
) {
  throw new Error(
    'Production requires HTTPS Supabase Auth, MongoDB, and HTTPS or Chrome extension CORS origins.',
  );
}

export const isLocalDevelopment = env.NODE_ENV === 'development' && !env.SUPABASE_URL;