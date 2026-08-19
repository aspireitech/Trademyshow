"use client";

/**
 * Client fetch wrapper that echoes the CSRF cookie back as a header.
 *
 * This is the other half of the double-submit check: a cross-site page can
 * cause the browser to send our cookies, but it cannot read them, so it cannot
 * set this header.
 */
function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)tms_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers.set("x-csrf-token", token);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(input, { ...init, headers });
}

/** POST JSON and return the parsed body plus the response. */
export async function apiPost<T = unknown>(
  url: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await apiFetch(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

/** Where the analytics consent decision is remembered. */
export const ANALYTICS_CONSENT_KEY = "tms_analytics_consent";

function analyticsAllowed(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted";
  } catch {
    // Storage blocked or unavailable — no consent recorded, so no tracking.
    return false;
  }
}

/**
 * Fire-and-forget product event; never blocks or throws into the UI.
 *
 * Silently does nothing without consent. The check lives here rather than at
 * each call site so a new `track()` call cannot accidentally bypass it.
 */
export function track(name: string, props?: Record<string, unknown>): void {
  if (!analyticsAllowed()) return;
  void apiFetch("/api/analytics", {
    method: "POST",
    body: JSON.stringify({ name, props }),
  }).catch(() => {});
}
