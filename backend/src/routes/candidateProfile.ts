import { Router } from 'express';
import { getProfile, upsertProfile } from '../controllers/candidateProfile.js';

const router = Router();
router.get('/', getProfile);
router.put('/', upsertProfile);

export default router;
