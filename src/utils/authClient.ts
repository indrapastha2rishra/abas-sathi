const DEFAULT_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbzkKY-gpDVkUQqQ3hWunjLNCILa5TymDNx0iOp6s6w02tzZ_Zc3yRDNBqqZY9x7Jw/exec';

export function backendUrl(): string {
  try {
    const cfg = JSON.parse(localStorage.getItem('abasSathiGoogleConfig') || '{}');
    return cfg.appsScriptWebAppUrl || DEFAULT_BACKEND_URL;
  } catch { return DEFAULT_BACKEND_URL; }
}

export async function authRequest<T = any>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(backendUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || `Request failed (${response.status})`);
  }
  return result as T;
}
