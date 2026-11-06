import { Router } from 'express';
import {
  calculateMatch,
  getMatch,
  getMatchSummary,
  getSkillGaps,
  listMatches,
  recalculateMatches,
} from '../controllers/matches.js';

const router = Router();

// Sub-resources must precede /:id
router.get('/summary', getMatchSummary);
router.get('/skill-gaps', getSkillGaps);
router.post('/recalculate', recalculateMatches);

// Base match listing & calculation
router.get('/', listMatches);
router.post('/', calculateMatch);

// Entity-specific operations
router.get('/:id', getMatch);

export default router;
