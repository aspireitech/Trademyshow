import crypto from "node:crypto";
import { getDb } from "./db";
import { captureError } from "./observability";

/**
 * Rate limiting, request fingerprinting and the audit trail.
 *
 * The limiter is a fixed-window counter in SQLite. That is deliberately modest:
 * it survives restarts (an in-memory map does not) and needs no extra service.
 * Behind more than one instance this under-counts, so move the same interface
 * to Redis when you scale horizontally — the call sites will not change.
 */

// ---------- request fingerprinting ----------

/**
 * IPs are personal data, so only a salted hash is ever stored. Without the
 * salt the hash of an IPv4 address is trivially reversible by brute force.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.AUTH_SECRET ?? "dev-secret-not-for-production";
  return crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}

export function clientIp(req: Request): string | null {
  const h = req.headers;
  // x-forwarded-for is a client-controlled header; the left-most entry is only
  // trustworthy behind a proxy that overwrites it. Prefer the platform header.
  return (
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

// ---------- rate limiting ----------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  windowSeconds: number;
}

/** Tight on credential endpoints, looser on reads, strict on anything paid-for. */
export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  emailVerify: { limit: 10, windowSeconds: 3600 },
  digest: { limit: 30, windowSeconds: 3600 },
  api: { limit: 300, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export function rateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): RateLimitResult {
  const db = getDb();
  const nowMs = now.getTime();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;

  const row = db.prepare("SELECT count, window_start FROM rate_limits WHERE key = ?").get(key) as
    | { count: number; window_start: number }
    | undefined;

  if (!row || row.window_start !== windowStart) {
    db.prepare(
      "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)\n" +
        "ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start",
    ).run(key, windowStart);
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (row.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((windowStart + windowMs - nowMs) / 1000),
    };
  }

  db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
  return { allowed: true, remaining: rule.limit - row.count - 1, retryAfterSeconds: 0 };
}

/** Convenience: limit by route name + caller fingerprint. */
export function limitRequest(
  req: Request,
  name: keyof typeof RATE_LIMITS,
  extra?: string,
): RateLimitResult {
  const fingerprint = hashIp(clientIp(req)) ?? "unknown";
  return rateLimit(`${name}:${fingerprint}${extra ? `:${extra}` : ""}`, RATE_LIMITS[name]);
}

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "Too many attempts. Please wait and try again." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

// ---------- audit log ----------

/**
 * Record a security-relevant event.
 *
 * Deliberately swallows its own failures: an audit write is a side-channel,
 * and a broken one must never turn a successful login into a 500. The error
 * still goes to the error reporter so a silently dead audit trail is visible.
 */
export function audit(
  userId: number | null,
  action: string,
  detail?: string,
  req?: Request,
): void {
  try {
    getDb()
      .prepare("INSERT INTO audit_log (user_id, action, detail, ip_hash) VALUES (?, ?, ?, ?)")
      .run(userId, action, detail ?? null, req ? hashIp(clientIp(req)) : null);
  } catch (err) {
    void captureError(err, { route: "lib/security#audit", extra: { action } });
  }
}

export interface AuditEntry {
  id: number;
  action: string;
  detail: string | null;
  createdAt: string;
}

export function recentAudit(userId: number, limit = 50): AuditEntry[] {
  const rows = getDb()
    .prepare(
      "SELECT id, action, detail, created_at FROM audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(userId, limit) as { id: number; action: string; detail: string | null; created_at: string }[];
  return rows.map((r) => ({ id: r.id, action: r.action, detail: r.detail, createdAt: r.created_at }));
}

// ---------- password strength ----------

export interface PasswordCheck {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  problems: string[];
}

/**
 * The 20 passwords that dominate every breach corpus. A full dictionary belongs
 * behind an API (Have I Been Pwned's k-anonymity range endpoint); this catches
 * the worst offenders with no network call.
 */
const COMMON = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "letmein", "welcome", "monkey", "dragon",
  "iloveyou", "admin", "admin123", "football", "baseball", "sunshine", "princess",
]);

/**
 * Composition rules push people towards exactly one mutation: take a common
 * password, capitalise the first letter, bolt digits and a "!" on the end.
 * "Password123!" satisfies every rule above and sits near the top of every
 * credential-stuffing list, so the lookup has to see through that mutation.
 */
function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return true;
  // Strip trailing digits and symbols, then any remaining non-alphanumerics.
  const core = lower.replace(/[^a-z0-9]+$/g, "").replace(/[0-9]+$/g, "");
  return core.length > 0 && COMMON.has(core);
}

export function checkPassword(password: string, email?: string): PasswordCheck {
  const problems: string[] = [];

  if (password.length < 10) problems.push("Use at least 10 characters.");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    problems.push("Mix upper and lower case.");
  }
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
    problems.push("Include a number or a symbol.");
  }
  if (isCommon(password)) {
    problems.push("This is one of the most common passwords in use.");
  }
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length > 2 && password.toLowerCase().includes(local)) {
      problems.push("Do not include your email address.");
    }
  }
  if (/^(.)\1+$/.test(password)) problems.push("Do not repeat a single character.");

  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (problems.length > 0) score = Math.min(score, 1);

  return { ok: problems.length === 0, score: Math.min(score, 4) as 0 | 1 | 2 | 3 | 4, problems };
}
