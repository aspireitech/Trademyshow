import { ProviderError, type FailureKind, type ProviderName } from "./types";

/**
 * Cross-SDK error classification.
 *
 * The Anthropic, OpenAI and Google SDKs all throw different error classes, so
 * rather than depending on any one of them we read the two things they agree
 * on: an HTTP status code (under one of several property names) and the
 * message text. This keeps the router decoupled from SDK internals and means a
 * provider SDK upgrade can't silently break failover.
 */

function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"]) {
    const v = e[key];
    if (typeof v === "number" && v >= 100 && v < 600) return v;
    // Google surfaces numeric codes as strings in some paths.
    if (typeof v === "string" && /^\d{3}$/.test(v)) return Number(v);
  }
  // Nested shapes: { error: { code: 429 } } / { response: { status: 429 } }
  for (const key of ["error", "response"]) {
    const nested = e[key];
    if (typeof nested === "object" && nested !== null) {
      const s = statusOf(nested);
      if (s !== undefined) return s;
    }
  }
  return undefined;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Parse a Retry-After hint from headers or message text, in seconds. */
function retryAfterOf(err: unknown, message: string): number | undefined {
  if (typeof err === "object" && err !== null) {
    const headers = (err as { headers?: unknown }).headers;
    if (headers) {
      let raw: string | undefined;
      if (typeof (headers as Headers).get === "function") {
        raw = (headers as Headers).get("retry-after") ?? undefined;
      } else if (typeof headers === "object") {
        const h = headers as Record<string, unknown>;
        const v = h["retry-after"] ?? h["Retry-After"];
        if (typeof v === "string" || typeof v === "number") raw = String(v);
      }
      if (raw && !Number.isNaN(Number(raw))) return Number(raw);
    }
  }
  // Google returns e.g. "retryDelay":"37s" inside the error payload.
  const m = message.match(/retry(?:Delay|-after)"?[:\s]+"?(\d+(?:\.\d+)?)s?/i);
  return m ? Number(m[1]) : undefined;
}

const RATE_LIMIT_PATTERNS =
  /rate.?limit|resource.?exhausted|quota|too many requests|insufficient_quota|billing hard limit|overloaded|capacity/i;
const AUTH_PATTERNS =
  /api.?key|unauthorized|authentication|permission|forbidden|invalid.?credential|unregistered caller/i;
const TRANSIENT_PATTERNS =
  /timeout|timed out|econnreset|enotfound|econnrefused|socket hang up|network|fetch failed|unavailable|internal error|bad gateway/i;

export function classify(provider: ProviderName, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;

  const message = messageOf(err);
  const status = statusOf(err);
  const retryAfterSec = retryAfterOf(err, message);

  let kind: FailureKind;

  if (status === 429) {
    kind = "rate_limit";
  } else if (status === 401 || status === 403) {
    // 403 from Google is often quota-related rather than credential-related.
    kind = RATE_LIMIT_PATTERNS.test(message) ? "rate_limit" : "auth";
  } else if (status === 529 || (status !== undefined && status >= 500)) {
    // Anthropic 529 = overloaded. Worth one retry, then fail over.
    kind = "transient";
  } else if (status === 400 || status === 404 || status === 422) {
    // A malformed request or unknown model fails identically everywhere —
    // failing over would just mask a configuration bug.
    kind = "permanent";
  } else if (RATE_LIMIT_PATTERNS.test(message)) {
    kind = "rate_limit";
  } else if (AUTH_PATTERNS.test(message)) {
    kind = "auth";
  } else if (TRANSIENT_PATTERNS.test(message)) {
    kind = "transient";
  } else {
    // Unknown failure: treat as transient so the request still has a chance
    // of being served, rather than hard-failing on an error we don't model.
    kind = "transient";
  }

  return new ProviderError(provider, kind, message, retryAfterSec, err);
}
