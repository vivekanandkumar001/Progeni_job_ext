import { Router } from 'express';
import { calculateMatch, getMatch, listMatches } from '../controllers/matches.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();
router.get('/', authMiddleware, listMatches);
router.get('/:id', authMiddleware, getMatch);
router.post('/', authMiddleware, calculateMatch);

export default router;