import { Router } from 'express';
import { listJobs, getJob, createJob } from '../controllers/jobs.js';
import { authMiddleware, requireRole } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, listJobs);
router.get('/:id', authMiddleware, getJob);
router.post('/', authMiddleware, requireRole('admin'), createJob);

export default router;