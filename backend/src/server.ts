import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/errorHandler.js';
import { env, isLocalDevelopment } from './config/env.js';
import { getDatabase } from './config/mongodb.js';
import candidateProfileRoutes from './routes/candidateProfile.js';
import resumeRoutes from './routes/resume.js';
import resumeStudioRoutes from './routes/resumeStudio.js';
import jobRoutes from './routes/jobs.js';
import matchRoutes from './routes/matches.js';
import applicationRoutes from './routes/applications.js';
import authRoutes from './routes/auth.js';
import candidateRoutes from './routes/candidate.js';
import trackerRoutes from './routes/tracker.js';
import interviewRoutes from './routes/interviews.js';
import followUpRoutes from './routes/followUps.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import progeniIntegrationRoutes from './routes/progeniIntegration.js';
import { handleProgeniWebhook } from './controllers/progeniIntegration.js';
import billingRoutes from './routes/billing.js';
import adminBillingRoutes from './routes/adminBilling.js';
import { handlePaymentWebhook } from './controllers/billing.js';
import { localMvpRoutes, productionWorkspaceRoutes } from './routes/localMvp.js';
import { authMiddleware, requireConsent, requireRole, requireAdmin, AuthRequest } from './middlewares/auth.js';
import { localDataStore } from './services/localDataStore.js';
import { mongoWorkspaceStore } from './services/mongoWorkspaceStore.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const localOrigin =
      isLocalDevelopment &&
      origin !== undefined &&
      (/^https?:\/\/(localhost|127\.0\.0\.1):(3000|3001|3002|5173)$/.test(origin) ||
        /^chrome-extension:\/\/[a-p]{32}$/.test(origin));
    const allowed = origin === undefined || localOrigin || env.CORS_ALLOWED_ORIGINS.includes(origin);
    callback(null, allowed ? origin : false);
  },
  credentials: true,
}));
app.use(express.json({ limit: isLocalDevelopment ? '10mb' : '4mb' }));

app.get('/health', async (_req, res, next) => {
  try {
    if (!isLocalDevelopment) {
      await (await getDatabase()).command({ ping: 1 });
    }
    res.json({ status: 'ok', message: 'Auto Apply Backend Running' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/candidate', candidateRoutes);

if (isLocalDevelopment) {
  app.use('/api/v1/local', localMvpRoutes);
} else {
  app.use('/api/v1/workspace', productionWorkspaceRoutes);
}
const workspaceStore = isLocalDevelopment ? localDataStore : mongoWorkspaceStore;
const requireCandidateConsent = requireConsent((userId) => workspaceStore.hasConsent(userId));
const candidateAccess = [
  authMiddleware,
  requireRole('candidate', 'premium_candidate'),
  requireCandidateConsent,
];
app.use('/api/v1/profile', ...candidateAccess, candidateProfileRoutes);
app.use('/api/v1/resumes', ...candidateAccess, resumeStudioRoutes, resumeRoutes);
app.use('/api/v1/resume-studio', ...candidateAccess, resumeStudioRoutes);

// For jobs: Admin has full access. For candidates with consent: full read, save, unsave, import, discover access. Root creation (POST /) requires admin role.
app.use('/api/v1/jobs', authMiddleware, (req, res, next) => {
  const authReq = req as AuthRequest;
  if (authReq.userRole === 'admin') {
    return next();
  }
  if (req.method === 'POST' && (req.path === '/' || req.path === '')) {
    return requireAdmin(req, res, next);
  }
  return requireRole('candidate', 'premium_candidate')(req, res, (err) => {
    if (err) return next(err);
    requireCandidateConsent(req, res, next);
  });
}, jobRoutes);

app.use('/api/v1/matches', ...candidateAccess, matchRoutes);
app.use('/api/v1/applications', ...candidateAccess, applicationRoutes);
app.use('/api/v1/tracker', ...candidateAccess, trackerRoutes);
app.use('/api/v1/interviews', ...candidateAccess, interviewRoutes);
app.use('/api/v1/follow-ups', ...candidateAccess, followUpRoutes);
app.use('/api/v1/analytics', ...candidateAccess, analyticsRoutes);
app.use('/api/v1/notifications', ...candidateAccess, notificationRoutes);

// Progeni Atlas Interviewer Platform Integration
app.post('/api/v1/integration/progeni/webhook', handleProgeniWebhook);
app.use('/api/v1/integration/progeni', ...candidateAccess, progeniIntegrationRoutes);

// Phase 9: SaaS Administration, Billing & Usage Management
app.post('/api/v1/billing/webhook', handlePaymentWebhook);
app.use('/api/v1/billing', ...candidateAccess, billingRoutes);
app.use('/api/v1/admin/billing', adminBillingRoutes);

app.get('/api/v1/admin/health', authMiddleware, requireAdmin, (_req, res) => {
  res.json({ status: 'ok', admin: true, timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;

const isTestEnvironment =
  process.env.NODE_ENV === 'test' ||
  process.env.AUTO_APPLY_TEST === '1' ||
  process.argv.some((arg) => arg.includes('test')) ||
  process.execArgv.some((arg) => arg.includes('test'));

if (process.env.VERCEL !== '1' && !isTestEnvironment) {
  const PORT = env.PORT;
  const HOST = '127.0.0.1';
  app.listen(Number(PORT), HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}
