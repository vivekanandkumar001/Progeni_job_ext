import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

console.log('================================================================');
console.log('       AUTO APPLY AI — PRODUCTION PRE-FLIGHT VERIFIER           ');
console.log('================================================================\n');

const envPath = fs.existsSync('./backend/.env.production')
  ? './backend/.env.production'
  : './.env.production';

if (!fs.existsSync(envPath)) {
  console.error(`[FAIL] Production configuration file not found at: ${envPath}`);
  process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function check(title, condition, failMsg, isWarning = false) {
  if (condition) {
    console.log(`[PASS] ${title}`);
    passCount++;
  } else if (isWarning) {
    console.log(`[WARN] ${title} — ${failMsg}`);
    warnCount++;
  } else {
    console.log(`[FAIL] ${title} — ${failMsg}`);
    failCount++;
  }
}

// 1. NODE_ENV Check
check(
  'NODE_ENV is set to production',
  envConfig.NODE_ENV === 'production',
  `Expected "production", got "${envConfig.NODE_ENV}"`
);

// 2. JWT_SECRET Strength Check
const jwtSecret = envConfig.JWT_SECRET || '';
check(
  'JWT_SECRET is cryptographically strong',
  jwtSecret.length >= 32 && !jwtSecret.includes('local-development-secret'),
  'JWT_SECRET must be at least 32 characters and cannot be default local secret'
);

// 3. MONGODB_URI Format Check
const mongoUri = envConfig.MONGODB_URI || '';
check(
  'MONGODB_URI is configured with valid scheme',
  mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'),
  'MONGODB_URI must start with mongodb:// or mongodb+srv://'
);

// 4. SUPABASE_URL HTTPS Check
const supabaseUrl = envConfig.SUPABASE_URL || '';
check(
  'SUPABASE_URL is configured with HTTPS',
  supabaseUrl.startsWith('https://'),
  'SUPABASE_URL must be a valid https:// URL'
);

// 5. SUPABASE_ANON_KEY Check
check(
  'SUPABASE_ANON_KEY is provided',
  Boolean(envConfig.SUPABASE_ANON_KEY && envConfig.SUPABASE_ANON_KEY.length > 20),
  'SUPABASE_ANON_KEY is required for candidate identity verification'
);

// 6. CORS_ALLOWED_ORIGINS HTTPS & Chrome Extension Check
const corsOrigins = (envConfig.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const validCors = corsOrigins.length > 0 && corsOrigins.every(
  (origin) => origin.startsWith('https://') || origin.startsWith('chrome-extension://')
);
check(
  'CORS_ALLOWED_ORIGINS enforces HTTPS or chrome-extension://',
  validCors,
  'All production CORS origins must start with https:// or chrome-extension://'
);

// 7. RAZORPAY Production Credentials Check
const rzpKey = envConfig.RAZORPAY_KEY_ID || '';
const isLiveRzp = rzpKey.startsWith('rzp_live_');
check(
  'Razorpay credentials configured',
  Boolean(rzpKey && envConfig.RAZORPAY_KEY_SECRET),
  'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required'
);
check(
  'Razorpay live mode verification',
  isLiveRzp,
  `Currently set to test/sandbox (${rzpKey}). Inject rzp_live_ keys for live payments.`,
  true // Warning, allowed in staging
);

// 8. Build Artifacts Check
const distServer = fs.existsSync(path.resolve(import.meta.dirname, '../dist/server.js'))
  ? path.resolve(import.meta.dirname, '../dist/server.js')
  : path.resolve('backend/dist/server.js');
check(
  'Backend compiled distribution exists (dist/server.js)',
  fs.existsSync(distServer),
  'Run "npm run build --prefix backend" to compile TypeScript'
);

console.log('\n----------------------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${warnCount} Warnings, ${failCount} Failed`);
console.log('----------------------------------------------------------------');

if (failCount > 0) {
  console.log('\n[STATUS] Production pre-flight failed. Resolve the [FAIL] items above before launch.');
  process.exit(1);
} else if (warnCount > 0) {
  console.log('\n[STATUS] Production pre-flight passed with staging warnings. Ready for staging deployment!');
  process.exit(0);
} else {
  console.log('\n[STATUS] Production pre-flight completely passed. 100% Ready for live commercial launch!');
  process.exit(0);
}
