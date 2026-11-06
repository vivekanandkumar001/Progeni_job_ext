import { Router } from 'express';
import { getApplicationAnalytics } from '../controllers/analytics.js';

const router = Router();

router.get('/applications', getApplicationAnalytics);

export default router;

