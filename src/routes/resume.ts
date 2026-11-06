import { Router } from 'express';
import { getResume, listResumes, upsertResume, deleteResume } from '../controllers/resume.js';

const router = Router();
router.get('/', listResumes);
router.get('/:id', getResume);
router.post('/', upsertResume);
router.delete('/:id', deleteResume);

export default router;
