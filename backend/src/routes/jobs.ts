import { Router } from 'express';
import { listJobs, getJob, createJob } from '../controllers/jobs.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, listJobs);
router.get('/:id', authMiddleware, getJob);
router.post('/', authMiddleware, createJob);

export default router;