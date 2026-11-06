import { Router } from 'express';
import {
  launchProgeniSession,
  syncProgeniSession,
  listProgeniSessions,
} from '../controllers/progeniIntegration.js';

const router = Router();

router.post('/launch', launchProgeniSession);
router.post('/sync/:sessionId', syncProgeniSession);
router.get('/sessions', listProgeniSessions);

export default router;
