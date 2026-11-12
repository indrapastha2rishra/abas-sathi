const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbxxlu1phgG2mxJE-atFXlwEqixpVUHHaSUWndNgvDhRTPPU8X7vSORZnvxKvYCZ6Jvj0w/exec';
const LEGACY_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec';

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

/** Resolve the current Apps Script deployment and transparently migrate the old bundled URL. */
export function backendUrl(): string {
  try {
    const cfg = JSON.parse(localStorage.getItem('abasSathiGoogleConfig') || '{}');
    const configured = String(cfg.appsScriptWebAppUrl || '').trim();
    if (!configured || configured === LEGACY_BACKEND_URL) {
      if (configured === LEGACY_BACKEND_URL) {
        localStorage.setItem('abasSathiGoogleConfig', JSON.stringify({
          ...cfg, appsScriptWebAppUrl: DEFAULT_BACKEND_URL
        }));
      }
      return DEFAULT_BACKEND_URL;
    }
    return configured;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

/**
 * Apps Script Web Apps redirect ContentService responses to googleusercontent.
 * Keep this as a simple CORS POST (text/plain avoids a preflight OPTIONS request),
 * omit Google account cookies, follow Google's redirect, and always parse the
 * final response body. This works with public "Anyone" web-app deployments.
 */
export async function authRequest<T = any>(
  payload: Record<string, unknown>,
  options: AuthRequestOptions = {}
): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 25000);
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  try {
    let response: Response;
    try {
      response = await fetch(backendUrl(), {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller?.signal,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new BackendRequestError('The server did not respond within the allowed time. Please retry.', undefined, false);
      }
      const detail = String(error?.message || '');
      throw new BackendRequestError(
        `Could not reach the ABAS SATHI server. Check that the Apps Script Web App is deployed for access by anyone and that the deployment URL is current. ${detail}`.trim(),
        undefined,
        true
      );
    }

    let raw = '';
    try { raw = await response.text(); }
    catch {
      throw new BackendRequestError('The server connection closed before returning a response. Please retry.', response.status, true);
    }

    let result: any;
    try { result = JSON.parse(raw.replace(/^\uFEFF/, '').trim()); }
    catch {
      const preview = raw.slice(0, 160).replace(/\s+/g, ' ');
      throw new BackendRequestError(
        `The Apps Script endpoint returned a non-JSON response (HTTP ${response.status}). Check Web App deployment access and URL. ${preview}`,
        response.status,
        response.status >= 500
      );
    }

    if (!response.ok || result?.status !== 'success') {
      const message = result?.message || `Request failed (HTTP ${response.status})`;
      throw new BackendRequestError(message, response.status, response.status >= 500);
    }
    return result as T;
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}
