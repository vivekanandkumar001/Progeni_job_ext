import { extractJob } from './jobAdapter';
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
