import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DETECTED_JOB_STORAGE_KEY } from '../shared/messages';

const SUPPORTED_HOSTS = ['naukri.com', 'linkedin.com', 'indeed.com'];
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const hasSupabaseConfiguration = Boolean(supabaseUrl || supabaseAnonKey);
const isLocalBuild = import.meta.env.DEV || import.meta.env.PROGENI_LOCAL;
const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || '';
const defaultApiUrl = isLocalBuild
  ? 'http://127.0.0.1:5000/api/v1/local'
  : 'https://job.progeni.live/api/v1/workspace';
const API_BASE_URL = configuredApiUrl
  ? /\/api\/v1\/(local|workspace)$/.test(configuredApiUrl)
    ? configuredApiUrl
    : `${configuredApiUrl}/api/v1/workspace`
  : defaultApiUrl;
let supabaseClient: SupabaseClient | null = null;
const trustedStorageReady = chrome.storage.local.setAccessLevel({
  accessLevel: 'TRUSTED_CONTEXTS',
});

interface ApiResponse {
  ok?: boolean;
  error?: string;
  token?: string;
  accepted?: boolean;
  authenticated?: boolean;
  local?: boolean;
  confirmationRequired?: boolean;
  email?: string;
  [key: string]: unknown;
}

function getSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('The production extension is missing Supabase authentication configuration.');
  }
  if (!supabaseClient) {
    const storage = {
      async getItem(key: string) {
        const values = await chrome.storage.local.get(key);
        return typeof values[key] === 'string' ? values[key] as string : null;
      },
      async setItem(key: string, value: string) {
        await chrome.storage.local.set({ [key]: value });
      },
      async removeItem(key: string) {
        await chrome.storage.local.remove(key);
      },
    };
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
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
  // First check trusted storage for paired localApiToken
  const cached = await chrome.storage.local.get(['localApiToken']);
  if (typeof cached.localApiToken === 'string' && cached.localApiToken) {
    return cached.localApiToken;
  }

  if (hasSupabaseConfiguration) {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) throw new Error(`Could not restore your sign-in: ${error.message}`);
    if (!data.session) throw new Error('Sign in to your Progeni account to continue.');
    return data.session.access_token;
  }
  if (!isLocalBuild) {
    throw new Error('The production extension is missing Supabase authentication configuration.');
  }

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
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const base = path.startsWith('/jobs') || path.startsWith('/applications') || path.startsWith('/matches')
    ? API_BASE_URL.replace(/\/api\/v1\/(local|workspace)$/, '/api/v1')
    : API_BASE_URL;
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  let body: ApiResponse;
  try {
    body = await response.json() as ApiResponse;
  } catch {
    throw new Error(`The Progeni API returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      await chrome.storage.local.remove('localApiToken');
    }
    const error = new Error(body.error || `Progeni API request failed (${response.status}).`);
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
  email?: string;
  password?: string;
  code?: string;
}): Promise<ApiResponse> {
  await trustedStorageReady;
  switch (message.type) {
    case 'GET_DETECTED_JOB': {
      const stored = await chrome.storage.session.get(DETECTED_JOB_STORAGE_KEY);
      return { ok: true, job: stored[DETECTED_JOB_STORAGE_KEY] ?? null };
    }
    case 'GET_AUTH_STATE': {
      // First check local/paired token in trusted storage
      const cached = await chrome.storage.local.get(['localApiToken']);
      if (typeof cached.localApiToken === 'string' && cached.localApiToken) {
        return { ok: true, authenticated: true, local: true };
      }

      if (!hasSupabaseConfiguration) {
        if (!isLocalBuild) {
          throw new Error('The production extension is missing Supabase authentication configuration.');
        }
        return { ok: true, authenticated: true, local: true };
      }
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw new Error(`Could not restore your sign-in: ${error.message}`);
      return {
        ok: true,
        authenticated: Boolean(data.session),
        local: false,
        email: data.session?.user.email,
      };
    }
    case 'PAIR_WITH_CODE': {
      if (!message.code || typeof message.code !== 'string') {
        throw new Error('A valid pairing code is required.');
      }
      const cleanCode = message.code.trim().toUpperCase();
      const origin = API_BASE_URL.replace(/\/api\/v1\/(local|workspace)$/, '');
      const response = await fetch(`${origin}/api/v1/auth/extension/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode }),
      });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.token) {
        throw new Error(body.error || 'Failed to link with pairing code.');
      }
      await chrome.storage.local.set({ localApiToken: body.token });
      return { ok: true, authenticated: true, local: true, email: (body.user as any)?.email };
    }
    case 'SIGN_IN': {
      if (!message.email || !message.password) throw new Error('Email and password are required.');
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: message.email.trim(),
        password: message.password,
      });
      if (error) throw new Error(error.message);
      return { ok: true, authenticated: Boolean(data.session), email: data.user?.email };
    }
    case 'SIGN_UP': {
      if (!message.email || !message.password) throw new Error('Email and password are required.');
      if (message.password.length < 8) throw new Error('Passwords must contain at least 8 characters.');
      const { data, error } = await getSupabaseClient().auth.signUp({
        email: message.email.trim(),
        password: message.password,
      });
      if (error) throw new Error(error.message);
      return {
        ok: true,
        authenticated: Boolean(data.session),
        confirmationRequired: !data.session,
        email: data.user?.email,
      };
    }
    case 'SIGN_OUT': {
      if (hasSupabaseConfiguration) {
        try {
          await getSupabaseClient().auth.signOut();
        } catch {
          // Ignore network errors during sign out
        }
      }
      await chrome.storage.local.remove('localApiToken');
      await chrome.storage.session.remove(DETECTED_JOB_STORAGE_KEY);
      return { ok: true, authenticated: false };
    }
    case 'GET_CONSENT': {
      return localApi('/consent');
    }
    case 'SAVE_CONSENT': {
      return localApi('/consent', {
        method: 'POST',
        body: JSON.stringify({ accepted: true }),
      });
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
    case 'IMPORT_JOB':
      return localApi('/jobs/import', {
        method: 'POST',
        body: JSON.stringify(message.payload),
      });
    case 'SAVE_JOB':
      if (!message.jobId) throw new Error('Job ID is required to save job.');
      return localApi(`/jobs/${encodeURIComponent(message.jobId)}/save`, {
        method: 'POST',
        body: JSON.stringify({ notes: message.notes }),
      });
    case 'UNSAVE_JOB':
      if (!message.jobId) throw new Error('Job ID is required to unsave job.');
      return localApi(`/jobs/${encodeURIComponent(message.jobId)}/save`, {
        method: 'DELETE',
      });
    case 'LIST_SAVED_JOBS':
      return localApi('/jobs/saved');
    default:
      throw new Error(`Unknown Progeni API request: ${message.type}`);
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
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`)
    ) {
      safeRespond(sendResponse, { ok: false, error: 'Job detection is accepted only from Progeni extension pages.' });
      return false;
    }
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
          error: 'Review and accept the Progeni data notice before detecting a job.',
          requestId,
        };
      }
      if (tabId === undefined) {
        throw new Error('Could not identify the active tab. Reopen the extension and try again.');
      }
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url !== url || !isSupportedUrl(tab.url)) {
        throw new Error('The active job page changed. Reopen the extension and try detection again.');
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
            const detected = response as { status?: unknown; job?: unknown };
            if (detected.status === 'supported' && detected.job && typeof detected.job === 'object') {
              void chrome.storage.session.set({ [DETECTED_JOB_STORAGE_KEY]: detected.job }).then(
                () => resolve(response),
                reject,
              );
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
    'GET_AUTH_STATE', 'PAIR_WITH_CODE', 'SIGN_IN', 'SIGN_UP', 'SIGN_OUT',
    'GET_CONSENT', 'SAVE_CONSENT', 'GET_CANDIDATE_PROFILE', 'SAVE_PROFILE',
    'GET_APPLICATIONS', 'CREATE_APPLICATION', 'UPDATE_APPLICATION',
    'GET_MATCHES', 'ANALYZE_JOB', 'GET_DETECTED_JOB',
    'IMPORT_JOB', 'SAVE_JOB', 'UNSAVE_JOB', 'LIST_SAVED_JOBS',
  ];
  if (apiMessages.includes(message.type)) {
    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`)
    ) {
      safeRespond(sendResponse, { ok: false, error: 'Workspace messages are accepted only from Progeni extension pages.' });
      return false;
    }
    void handleApiMessage(message).then(
      (response) => safeRespond(sendResponse, response),
      (error: unknown) => safeRespond(sendResponse, {
        ok: false,
        ...(error instanceof Error && 'code' in error ? { code: error.code } : {}),
        error: error instanceof Error ? error.message : 'The Progeni API request failed.',
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
