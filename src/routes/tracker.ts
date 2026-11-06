import { Router } from 'express';
import {
  listTrackedApplications,
  getApplicationDossier,
  updateStatus,
  recordSubmissionEvidence,
  getApplicationTimeline,
} from '../controllers/tracker.js';

const router = Router();

router.get('/', listTrackedApplications);
router.get('/:id', getApplicationDossier);
router.patch('/:id/status', updateStatus);
router.post('/:id/submission-evidence', recordSubmissionEvidence);
router.get('/:id/timeline', getApplicationTimeline);

export default router;

