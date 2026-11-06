export type MsgType =
  | 'PING'
  | 'PONG'
  | 'GET_CONSENT'
  | 'SAVE_CONSENT'
  | 'GET_AUTH_STATE'
  | 'SIGN_IN'
  | 'SIGN_UP'
  | 'SIGN_OUT'
  | 'PAIR_WITH_CODE'
  | 'DETECT_REQUEST'
  | 'DETECT_RESPONSE'
  | 'GET_DETECTED_JOB'
  | 'EXTRACT_JOB'
  | 'JOB_DETECTED'
  | 'GET_ACTIVE_TAB'
  | 'OPEN_POPUP'
  | 'OPEN_SIDE_PANEL'
  | 'GET_CANDIDATE_PROFILE'
  | 'SAVE_PROFILE'
  | 'GET_APPLICATIONS'
  | 'CREATE_APPLICATION'
  | 'UPDATE_APPLICATION'
  | 'GET_MATCHES'
  | 'ANALYZE_JOB'
  | 'IMPORT_JOB'
  | 'SAVE_JOB'
  | 'UNSAVE_JOB'
  | 'LIST_SAVED_JOBS'
  | 'MARK_DEMO_DATA'
  | 'DETECT_FORM_FIELDS'
  | 'PREVIEW_AUTOFILL'
  | 'APPLY_AUTOFILL'
  | 'PAGE_READY'
  | 'ERROR';

export const DETECTED_JOB_STORAGE_KEY = 'pendingDetectedJob';

export interface Message<T = unknown> {
  type: MsgType;
  payload?: T;
  requestId?: string;
  url?: string;
  tabId?: number;
  id?: string;
  jobId?: string;
  status?: string;
  notes?: string;
  code?: string;
  accepted?: boolean;
  email?: string;
  password?: string;
}

export function sendMessage<TResponse = unknown, TPayload = unknown>(
  msg: Message<TPayload>,
): Promise<TResponse> {
  return chrome.runtime.sendMessage(msg) as Promise<TResponse>;
}

export function sendTabMessage<TResponse = unknown, TPayload = unknown>(
  tabId: number,
  msg: Message<TPayload>,
): Promise<TResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message } as TResponse);
      } else {
        resolve(response as TResponse);
      }
    });
  });
}

export async function ensureSupabaseHostPermission(): Promise<void> {
  const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!configuredUrl) throw new Error('Supabase authentication is not configured for this extension.');
  const supabaseOrigin = new URL(configuredUrl);
  if (supabaseOrigin.protocol !== 'https:') {
    throw new Error('Supabase authentication must use HTTPS.');
  }
  const origins = [`${supabaseOrigin.origin}/*`];
  if (await chrome.permissions.contains({ origins })) return;
  if (!(await chrome.permissions.request({ origins }))) {
    throw new Error('Allow access to the Progeni sign-in service to continue.');
  }
}

export function makeRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}