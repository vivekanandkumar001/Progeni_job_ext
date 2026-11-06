import { Router } from 'express';
import {
  createJob,
  discoverJobs,
  getDiscoverySources,
  getDiscoveryStatus,
  getJob,
  importJob,
  listJobs,
  listSavedJobs,
  saveJob,
  unsaveJob,
} from '../controllers/jobs.js';

const router = Router();

// Sub-resource and specific routes MUST precede /:id
router.get('/saved', listSavedJobs);
router.get('/sources', getDiscoverySources);
router.get('/discovery/status', getDiscoveryStatus);
router.post('/discover', discoverJobs);
router.post('/import', importJob);

// Main listing & root creation
router.get('/', listJobs);
router.post('/', createJob);

// Entity-specific operations
router.get('/:id', getJob);
router.post('/:id/save', saveJob);
router.delete('/:id/save', unsaveJob);

export default router;
