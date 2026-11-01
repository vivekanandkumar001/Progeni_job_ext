export type MsgType =
  | 'PING'
  | 'PONG'
  | 'GET_CONSENT'
  | 'SAVE_CONSENT'
  | 'DETECT_REQUEST'
  | 'DETECT_RESPONSE'
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
  | 'MARK_DEMO_DATA'
  | 'PAGE_READY'
  | 'ERROR';

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
  accepted?: boolean;
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

export function makeRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}