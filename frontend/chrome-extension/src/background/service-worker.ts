const SUPPORTED_HOSTS = ['naukri.com', 'linkedin.com', 'indeed.com'];
const API_BASE_URL = 'http://127.0.0.1:5000/api/v1/local';

interface ApiResponse {
  ok?: boolean;
  error?: string;
  token?: string;
  accepted?: boolean;
  [key: string]: unknown;
}

function isSupportedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SUPPORTED_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

function safeRespond(sendResponse: (response: unknown) => void, payload: unknown): void {
  try {
    sendResponse(payload);
  } catch {
    // The extension page may close before the response is delivered.
  }
}

function makeRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function getApiToken(): Promise<string> {
  const cached = await chrome.storage.local.get(['localApiToken']);
  if (typeof cached.localApiToken === 'string') return cached.localApiToken;

  const response = await fetch(`${API_BASE_URL}/session`, { method: 'POST' });
  const body: ApiResponse = await response.json();
  if (!response.ok || typeof body.token !== 'string') {
    throw new Error(body.error || 'Could not connect to the local Progeni backend.');
  }
  await chrome.storage.local.set({ localApiToken: body.token });
  return body.token;
}

async function localApi(path: string, init?: RequestInit): Promise<ApiResponse> {
  const token = await getApiToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body: ApiResponse = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.local.remove('localApiToken');
    }
    const error = new Error(body.error || `Local API request failed (${response.status}).`);
    Object.assign(error, { code: body.code });
    throw error;
  }
  return body;
}

async function handleApiMessage(message: {
  type: string;
  payload?: unknown;
  id?: string;
  jobId?: string;
  status?: string;
  notes?: string;
}): Promise<ApiResponse> {
  switch (message.type) {
    case 'GET_CONSENT': {
      const result = await localApi('/consent');
      if (result.accepted === true) {
        await chrome.storage.local.set({ privacyConsentAccepted: true });
      } else {
        await chrome.storage.local.remove('privacyConsentAccepted');
      }
      return result;
    }
    case 'SAVE_CONSENT': {
      const result = await localApi('/consent', {
        method: 'POST',
        body: JSON.stringify({ accepted: true }),
      });
      await chrome.storage.local.set({ privacyConsentAccepted: true });
      return result;
    }
    case 'GET_CANDIDATE_PROFILE':
      return localApi('/profile');
    case 'SAVE_PROFILE':
      return localApi('/profile', {
        method: 'PUT',
        body: JSON.stringify(message.payload),
      });
    case 'ANALYZE_JOB':
      return localApi('/matches/analyze', {
        method: 'POST',
        body: JSON.stringify(message.payload),
      });
    case 'GET_APPLICATIONS':
      return localApi('/applications');
    case 'CREATE_APPLICATION':
      return localApi('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId: message.jobId }),
      });
    case 'UPDATE_APPLICATION':
      if (!message.id || !message.status) throw new Error('Application id and status are required.');
      return localApi(`/applications/${encodeURIComponent(message.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: message.status, notes: message.notes }),
      });
    case 'GET_MATCHES':
      return localApi('/matches');
    default:
      throw new Error(`Unknown local API request: ${message.type}`);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
    console.error('[Progeni] Could not configure the side panel.', error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    safeRespond(sendResponse, { ok: false, error: 'Invalid message: missing type.' });
    return false;
  }

  if (message.type === 'PING') {
    safeRespond(sendResponse, { ok: true, type: 'PONG', timestamp: Date.now() });
    return false;
  }

  if (message.type === 'GET_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      safeRespond(sendResponse, {
        ok: true,
        tabId: tab?.id ?? null,
        url: tab?.url || null,
        title: tab?.title || null,
        supported: tab?.url ? isSupportedUrl(tab.url) : false,
      });
    }).catch((error: unknown) => {
      safeRespond(sendResponse, {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not read the active tab.',
      });
    });
    return true;
  }

  if (message.type === 'DETECT_REQUEST') {
    const requestId = typeof message.requestId === 'string' ? message.requestId : makeRequestId();
    const url = typeof message.url === 'string' ? message.url : '';
    const tabId =
      typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;

    void (async () => {
      if (!url || !isSupportedUrl(url)) {
        return {
          ok: true,
          status: 'unsupported',
          platform: null,
          policy: 'manual_only',
          job: null,
          confidence: 0,
          missingFields: ['supported job page'],
          requestId,
        };
      }
      const consent = await localApi('/consent');
      if (consent.accepted !== true) {
        return {
          ok: false,
          code: 'CONSENT_REQUIRED',
          error: 'Review and accept the local data notice before detecting a job.',
          requestId,
        };
      }
      await chrome.storage.local.set({ privacyConsentAccepted: true });
      if (tabId === undefined) {
        throw new Error('Could not identify the active tab. Reopen the extension and try again.');
      }
      return new Promise<unknown>((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabId,
          { type: 'EXTRACT_JOB', url, requestId },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error('Refresh the job page and try detection again.'));
              return;
            }
            if (!response) {
              reject(new Error('The job page did not return any details.'));
              return;
            }
            resolve(response);
          },
        );
      });
    })().then(
      (response) => safeRespond(sendResponse, response),
      (error: unknown) => safeRespond(sendResponse, {
        ok: false,
        error: error instanceof Error ? error.message : 'Job detection failed.',
        requestId,
      }),
    );
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId === undefined) throw new Error('No active browser tab.');
      return chrome.sidePanel.open({ tabId });
    }).then(
      () => safeRespond(sendResponse, { ok: true }),
      (error: unknown) => safeRespond(sendResponse, {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not open the side panel.',
      }),
    );
    return true;
  }

  const apiMessages = [
    'GET_CONSENT', 'SAVE_CONSENT', 'GET_CANDIDATE_PROFILE', 'SAVE_PROFILE',
    'GET_APPLICATIONS', 'CREATE_APPLICATION', 'UPDATE_APPLICATION',
    'GET_MATCHES', 'ANALYZE_JOB',
  ];
  if (apiMessages.includes(message.type)) {
    void handleApiMessage(message).then(
      (response) => safeRespond(sendResponse, response),
      (error: unknown) => safeRespond(sendResponse, {
        ok: false,
        ...(error instanceof Error && 'code' in error ? { code: error.code } : {}),
        error: error instanceof Error ? error.message : 'The local backend request failed.',
      }),
    );
    return true;
  }

  if (message.type === 'PAGE_READY') {
    safeRespond(sendResponse, { ok: true, ready: true });
    return false;
  }

  safeRespond(sendResponse, { ok: false, error: `Unknown message type: ${message.type}.` });
  return false;
});
