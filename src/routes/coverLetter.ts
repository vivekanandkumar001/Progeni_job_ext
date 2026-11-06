import { Router } from 'express';
import { coverLetterService } from '../services/coverLetterService.js';

const router = Router();

/**
 * @route POST /api/v1/cover-letter
 * @desc Generate a tailored cover letter for a job application
 * @access Private (requires authentication)
 */
router.post('/', async (req, res) => {
  try {
    const {
      jobTitle,
      company,
      jobDescription,
      candidateSkills,
      candidateExperience,
      candidateTargetRole,
    } = req.body;

    if (!jobTitle || !company || !jobDescription) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: jobTitle, company, jobDescription',
      });
    }

    const request: any = {
      jobTitle,
      company,
      jobDescription,
      candidateSkills: candidateSkills || [],
      candidateExperience: candidateExperience ?? null,
      candidateTargetRole: candidateTargetRole || null,
    };

    const result = await coverLetterService.generate(request);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Cover letter API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating cover letter.',
    });
  }
});

export default router;