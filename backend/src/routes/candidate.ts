import { Router } from 'express';
import {
  authMiddleware,
  requireRole,
  requirePermission,
} from '../middlewares/auth.js';
import {
  getProfile,
  patchProfile,
  getPreferences,
  patchPreferences,
  uploadResume,
  parseResumePreview,
  listResumes,
  deleteResume,
  getOnboarding,
  patchOnboarding,
} from '../controllers/candidate.js';

const router = Router();

// Candidate access gate (candidates and premium candidates)
router.use(authMiddleware, requireRole('candidate', 'premium_candidate'));

// Profile management
router.get('/profile', requirePermission('candidate.profile.read'), getProfile);
router.patch('/profile', requirePermission('candidate.profile.update'), patchProfile);

// Career preferences
router.get('/preferences', requirePermission('candidate.profile.read'), getPreferences);
router.patch('/preferences', requirePermission('candidate.profile.update'), patchPreferences);

// Resume intelligence & management
router.post('/resume', requirePermission('candidate.resume.upload'), uploadResume);
router.post('/resume/parse', requirePermission('candidate.resume.upload'), parseResumePreview);
router.get('/resumes', requirePermission('candidate.resume.read'), listResumes);
router.delete('/resumes/:id', requirePermission('candidate.resume.delete'), deleteResume);

// Onboarding wizard & consent lifecycle
router.get('/onboarding', requirePermission('candidate.profile.read'), getOnboarding);
router.patch('/onboarding', requirePermission('candidate.profile.update'), patchOnboarding);

export default router;
