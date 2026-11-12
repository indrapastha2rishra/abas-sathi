const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec';

export type AuthRequestOptions = { timeoutMs?: number };

export class BackendRequestError extends Error {
  status?: number;
  retryable: boolean;
  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = 'BackendRequestError';
    this.status = status;
    this.retryable = retryable;
  }
}

export function backendUrl(): string {
  try {
    const cfg = JSON.parse(localStorage.getItem('abasSathiGoogleConfig') || '{}');
    return cfg.appsScriptWebAppUrl || DEFAULT_BACKEND_URL;
  } catch { return DEFAULT_BACKEND_URL; }
}

export async function authRequest<T = any>(
  payload: Record<string, unknown>,
  options: AuthRequestOptions = {}
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
  const timeout = timeoutMs && controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;
  try {
    let response: Response;
    try {
      response = await fetch(backendUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller?.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new BackendRequestError('The request took too long. Please try again.', undefined, false);
      throw new BackendRequestError('Network connection failed. Check your internet connection and retry.', undefined, true);
    }
    const raw = await response.text();
    let result: any;
    try { result = JSON.parse(raw); }
    catch { throw new BackendRequestError('The backend returned an unreadable response. Please retry; check the record before submitting again.', response.status, response.status >= 500); }
    if (!response.ok || result.status !== 'success') {
      const message = result.message || `Request failed (${response.status})`;
      throw new BackendRequestError(message, response.status, response.status >= 500);
    }
    return result as T;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}
