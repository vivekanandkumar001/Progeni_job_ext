import { extractJob, computeMatchScore } from './jobAdapter';
import {
  detectFormInputs,
  buildAutofillPlan,
  executeAutofill,
} from './ats/smartAutofill';

console.log('[Progeni] Content script loaded');

function safeSend(sendResponse: (response: unknown) => void, payload: unknown): void {
  try {
    sendResponse(payload);
  } catch {
    // port closed
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !msg.type) {
    safeSend(sendResponse, { ok: false, error: 'Invalid message: missing type' });
    return true;
  }

  if (msg.type === 'EXTRACT_JOB') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can request job extraction.' });
      return false;
    }
    const result = extractJob(location.href, document);
    safeSend(sendResponse, {
      ok: true,
      type: 'JOB_DETECTED',
      status: result.supported ? 'supported' : 'unsupported',
      ...result,
      requestId: msg.requestId,
    });
    return false;
  }

  if (msg.type === 'GET_PROFILE_SKILLS') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can request profile data.' });
      return false;
    }
    // Fetch candidate profile from backend
    fetch('/api/v1/workspace', {
      method: 'GET',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.skills) {
          safeSend(sendResponse, { ok: true, skills: data.skills, experience_years: data.experience_years });
        } else {
          safeSend(sendResponse, { ok: true, skills: [], experience_years: 0 });
        }
      })
      .catch(() => {
        safeSend(sendResponse, { ok: true, skills: [], experience_years: 0 });
      });
    return true;
  }

  if (msg.type === 'GET_PROFILE_EXPERIENCE') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can request profile data.' });
      return false;
    }
    fetch('/api/v1/workspace', {
      method: 'GET',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.experience_years !== undefined) {
          safeSend(sendResponse, { ok: true, experience_years: data.experience_years });
        } else {
          safeSend(sendResponse, { ok: true, experience_years: 0 });
        }
      })
      .catch(() => {
        safeSend(sendResponse, { ok: true, experience_years: 0 });
      });
    return true;
  }

  if (msg.type === 'COMPUTE_MATCH_SCORE') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can compute match scores.' });
      return false;
    }
    const { job, candidateSkills, candidateExperience } = msg.payload || {};
    if (!job) {
      safeSend(sendResponse, { ok: false, error: 'No job data provided.' });
      return false;
    }
    const result = computeMatchScore(job, candidateSkills || [], candidateExperience ?? null);
    safeSend(sendResponse, { ok: true, type: 'MATCH_SCORE_COMPUTED', ...result });
    return false;
  }

  if (msg.type === 'ANALYZE_JOB') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can analyze jobs.' });
      return false;
    }
    const { job, candidateSkills, candidateExperience } = msg.payload || {};
    if (!job) {
      safeSend(sendResponse, { ok: false, error: 'No job data provided.' });
      return false;
    }
    // Use the new computeMatchScore from jobAdapter
    const result = computeMatchScore(job, candidateSkills || [], candidateExperience ?? null);
    safeSend(sendResponse, { ok: true, match: result });
    return false;
  }

  if (msg.type === 'GENERATE_COVER_LETTER') {
    if (sender.id !== chrome.runtime.id) {
      safeSend(sendResponse, { ok: false, error: 'Only Progeni can generate cover letters.' });
      return false;
    }
    const { job } = msg.payload || {};
    if (!job) {
      safeSend(sendResponse, { ok: false, error: 'No job data provided.' });
      return false;
    }
    // Fetch candidate profile from backend
    fetch('/api/v1/workspace', {
      method: 'GET',
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.skills) {
          safeSend(sendResponse, { ok: false, error: 'Candidate profile not found. Please set up your profile first.' });
          return;
        }
        const request = {
          jobTitle: job.title || 'Job Position',
          company: job.company || 'Company',
          jobDescription: job.description || '',
          candidateSkills: data.skills,
          candidateExperience: data.experience_years ?? null,
          candidateTargetRole: data.target_role || null,
        };
        // Call the backend cover letter service
        fetch('/api/v1/cover-letter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(request),
        })
          .then((res) => res.json())
          .then((coverLetterResult) => {
            if (coverLetterResult.success && coverLetterResult.coverLetter) {
              safeSend(sendResponse, { ok: true, coverLetter: coverLetterResult.coverLetter });
            } else {
              safeSend(sendResponse, { ok: false, error: coverLetterResult.error || 'Failed to generate cover letter.' });
            }
          })
          .catch(() => {
            safeSend(sendResponse, { ok: false, error: 'Error communicating with cover letter service.' });
          });
      })
      .catch(() => {
        safeSend(sendResponse, { ok: false, error: 'Could not load candidate profile.' });
      });
    return true;
  }

  if (msg.type === 'DETECT_FORM_FIELDS') {
    const fields = detectFormInputs(document).map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      selector: f.selector,
      required: f.required,
    }));
    safeSend(sendResponse, { ok: true, fields, total: fields.length });
    return false;
  }

  if (msg.type === 'PREVIEW_AUTOFILL') {
    const candidateData = msg.payload?.candidateData || {};
    const isApproved = Boolean(msg.payload?.isApplicationApproved);
    const plan = buildAutofillPlan(document, candidateData, isApproved);
    safeSend(sendResponse, { ok: true, plan });
    return false;
  }

  if (msg.type === 'APPLY_AUTOFILL') {
    const plan = msg.payload?.plan;
    if (!plan) {
      safeSend(sendResponse, { ok: false, error: 'No autofill plan provided.' });
      return false;
    }
    const result = executeAutofill(document, plan);
    safeSend(sendResponse, result);
    return false;
  }

  if (msg.type === 'PAGE_READY') {
    safeSend(sendResponse, { ok: true, ready: true });
    return true;
  }

  safeSend(sendResponse, { ok: false, error: 'Unknown content message type: ' + msg.type });
  return true;
});
