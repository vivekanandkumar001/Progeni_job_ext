import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/errorHandler.js';
import { env, isLocalDevelopment } from './config/env.js';
import candidateProfileRoutes from './routes/candidateProfile.js';
import resumeRoutes from './routes/resume.js';
import jobRoutes from './routes/jobs.js';
import matchRoutes from './routes/matches.js';
import applicationRoutes from './routes/applications.js';
import localMvpRoutes from './routes/localMvp.js';
import { authMiddleware, requireRole } from './middlewares/auth.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const allowed =
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1):(3000|3001|3002|5173)$/.test(origin) ||
      (isLocalDevelopment && /^chrome-extension:\/\/[a-p]{32}$/.test(origin));
    callback(allowed ? null : new Error('Origin is not allowed by CORS.'), allowed ? origin : false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Auto Apply Backend Running', env: env.NODE_ENV, localMode: isLocalDevelopment });
});

if (isLocalDevelopment) {
  app.use('/api/v1/local', localMvpRoutes);
}
app.use('/api/v1/profile', authMiddleware, candidateProfileRoutes);
app.use('/api/v1/resumes', authMiddleware, resumeRoutes);
app.use('/api/v1/jobs', authMiddleware, jobRoutes);
app.use('/api/v1/matches', authMiddleware, matchRoutes);
app.use('/api/v1/applications', authMiddleware, applicationRoutes);

app.get('/api/v1/admin/health', authMiddleware, requireRole('admin'), (req, res) => {
  res.json({ status: 'ok', admin: true, timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const PORT = env.PORT;
const HOST = env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
app.listen(Number(PORT), HOST, () => {
  console.log('Server running on http://' + HOST + ':' + PORT);
});