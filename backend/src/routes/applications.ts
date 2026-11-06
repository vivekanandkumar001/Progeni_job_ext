import { Router } from 'express';
import {
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  generateResume,
  generateCoverLetter,
  generateAnswers,
  approveApplication,
  revokeApproval,
  exportApplication,
  transitionApplication,
  reconcileApplication,
} from '../controllers/applications.js';

const router = Router();

router.get('/', listApplications);
router.post('/', createApplication);
router.get('/:id', getApplication);
router.patch('/:id', updateApplication);

router.post('/:id/generate-resume', generateResume);
router.post('/:id/generate-cover-letter', generateCoverLetter);
router.post('/:id/generate-answers', generateAnswers);

router.post('/:id/approve', approveApplication);
router.post('/:id/revoke-approval', revokeApproval);
router.post('/:id/export', exportApplication);

router.patch('/:id/transition', transitionApplication);
router.post('/:id/reconcile', reconcileApplication);

export default router;
