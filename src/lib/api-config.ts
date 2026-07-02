/**
 * API configuration for HJTools X.
 *
 * - In development (localhost), API calls go to the local Next.js server.
 * - NEXT_PUBLIC_API_URL can override the base URL if needed.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Resolves an API path to a full URL.
 * - If API_BASE_URL is set, prepends it.
 * - If empty (dev/default), returns the path as-is (relative to current origin).
 */
export function apiUrl(path: string): string {
  if (!path.startsWith('/')) return path;
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  return path;
}

/**
 * Get or create session ID from localStorage.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem('hjtools_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem('hjtools_session_id', sid);
  }
  return sid;
}

/**
 * Enhanced fetch that adds session header.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(input);
  const sessionId = typeof window !== 'undefined' ? getSessionId() : '';

  const headers = new Headers(init?.headers);
  if (sessionId) {
    headers.set('x-session-id', sessionId);
  }
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
