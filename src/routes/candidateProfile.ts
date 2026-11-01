import { Router } from 'express';
import { getProfile, upsertProfile } from '../controllers/candidateProfile.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, getProfile);
router.put('/', authMiddleware, upsertProfile);

export default router;