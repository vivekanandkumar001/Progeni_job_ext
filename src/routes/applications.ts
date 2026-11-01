import { Router } from 'express';
import { listApplications, getApplication, createApplication, transitionApplication, reconcileApplication } from '../controllers/applications.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, listApplications);
router.get('/:id', authMiddleware, getApplication);
router.post('/', authMiddleware, createApplication);
router.patch('/:id/transition', authMiddleware, transitionApplication);
router.post('/:id/reconcile', authMiddleware, reconcileApplication);

export default router;