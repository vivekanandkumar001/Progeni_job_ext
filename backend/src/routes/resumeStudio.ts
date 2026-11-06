import { Router } from 'express';
import { requirePermission } from '../middlewares/auth.js';
import {
  getMasterResumeHandler,
  listResumesHandler,
  getResumeHandler,
  createResumeHandler,
  updateResumeHandler,
  publishResumeHandler,
  restoreResumeHandler,
  duplicateResumeHandler,
  deleteResumeHandler,
  diagnoseATSHandler,
  compareJDHandler,
  generateTargetedHandler,
  listClaimsHandler,
  createClaimHandler,
  confirmClaimHandler,
  deleteClaimHandler,
  exportPdfHandler,
  exportDocxHandler,
} from '../controllers/resumeStudio.js';

const router = Router();

// Master Resume
router.get('/master', requirePermission('candidate.resume.read'), getMasterResumeHandler);

// Resume Studio CRUD & Operations
router.get('/studio', requirePermission('candidate.resume.read'), listResumesHandler);
router.post('/studio', requirePermission('candidate.resume.upload'), createResumeHandler);
router.get('/studio/:id', requirePermission('candidate.resume.read'), getResumeHandler);
router.patch('/studio/:id', requirePermission('candidate.resume.update'), updateResumeHandler);
router.delete('/studio/:id', requirePermission('candidate.resume.delete'), deleteResumeHandler);
router.post('/studio/:id/publish', requirePermission('candidate.resume.update'), publishResumeHandler);
router.post('/studio/:id/restore', requirePermission('candidate.resume.update'), restoreResumeHandler);
router.post('/studio/:id/duplicate', requirePermission('candidate.resume.upload'), duplicateResumeHandler);

// Exports
router.get('/studio/:id/export/pdf', requirePermission('candidate.resume.export'), exportPdfHandler);
router.get('/studio/:id/export/docx', requirePermission('candidate.resume.export'), exportDocxHandler);

// Analyzer & Diagnostics
router.post('/analyzer/diagnose', requirePermission('candidate.resume.read'), diagnoseATSHandler);
router.post('/analyzer/compare-jd', requirePermission('candidate.resume.read'), compareJDHandler);

// Targeted Generation
router.post('/targeted/generate', requirePermission('candidate.resume.upload'), generateTargetedHandler);

// Truth Engine Claims & Verification
router.get('/truth/claims', requirePermission('candidate.resume.read'), listClaimsHandler);
router.post('/truth/claims', requirePermission('candidate.resume.upload'), createClaimHandler);
router.patch('/truth/claims/:claimId', requirePermission('candidate.resume.update'), confirmClaimHandler);
router.delete('/truth/claims/:claimId', requirePermission('candidate.resume.delete'), deleteClaimHandler);

export default router;

