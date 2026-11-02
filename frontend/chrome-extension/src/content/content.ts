import { extractJob } from './jobAdapter';

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

  if (msg.type === 'PAGE_READY') {
    safeSend(sendResponse, { ok: true, ready: true });
    return true;
  }

  safeSend(sendResponse, { ok: false, error: 'Unknown content message type: ' + msg.type });
  return true;
});