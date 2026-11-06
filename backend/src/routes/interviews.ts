import { Router } from 'express';
import {
  createInterview,
  listInterviews,
  getInterview,
  updateInterview,
  deleteInterview,
} from '../controllers/interviews.js';

const router = Router();

router.post('/', createInterview);
router.get('/', listInterviews);
router.get('/:id', getInterview);
router.patch('/:id', updateInterview);
router.delete('/:id', deleteInterview);

export default router;

