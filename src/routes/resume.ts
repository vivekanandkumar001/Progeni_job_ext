import { Router } from 'express';
import { getResume, listResumes, upsertResume, deleteResume } from '../controllers/resume.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, listResumes);
router.get('/:id', authMiddleware, getResume);
router.post('/', authMiddleware, upsertResume);
router.delete('/:id', authMiddleware, deleteResume);

export default router;