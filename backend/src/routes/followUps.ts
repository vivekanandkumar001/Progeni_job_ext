import { Router } from 'express';
import {
  createFollowUp,
  listFollowUps,
  getFollowUp,
  updateFollowUp,
  logFollowUpAction,
} from '../controllers/followUps.js';

const router = Router();

router.post('/', createFollowUp);
router.get('/', listFollowUps);
router.get('/:id', getFollowUp);
router.patch('/:id', updateFollowUp);
router.post('/:id/action', logFollowUpAction);

export default router;

