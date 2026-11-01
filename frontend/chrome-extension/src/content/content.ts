import { extractJob } from './jobAdapter';

console.log('[Progeni] Content script loaded');

function safeSend(sendResponse: (response: unknown) => void, payload: unknown): void {
  try {
    sendResponse(payload);
  } catch {
    // port closed
  }
}

function hasConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['privacyConsentAccepted'], (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(result.privacyConsentAccepted === true);
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !msg.type) {
    safeSend(sendResponse, { ok: false, error: 'Invalid message: missing type' });
    return true;
  }

  if (msg.type === 'EXTRACT_JOB') {
    void hasConsent().then((consent) => {
      if (!consent) {
        safeSend(sendResponse, {
          ok: false,
          code: 'CONSENT_REQUIRED',
          error: 'Review and accept the local data notice before detecting a job.',
          requestId: msg.requestId,
        });
        return;
      }
      const result = extractJob(location.href, document);
      safeSend(sendResponse, {
        ok: true,
        type: 'JOB_DETECTED',
        status: result.supported ? 'supported' : 'unsupported',
        ...result,
        requestId: msg.requestId,
      });
    });
    return true;
  }

  if (msg.type === 'DETECT_JOB') {
    void hasConsent().then((consent) => {
      if (!consent) {
        safeSend(sendResponse, { ok: false, code: 'CONSENT_REQUIRED' });
        return;
      }
      const result = extractJob(location.href, document);
      safeSend(sendResponse, { ok: true, url: location.href, ...result });
    });
    return true;
  }

  if (msg.type === 'PAGE_READY') {
    safeSend(sendResponse, { ok: true, ready: true });
    return true;
  }

  safeSend(sendResponse, { ok: false, error: 'Unknown content message type: ' + msg.type });
  return true;
});