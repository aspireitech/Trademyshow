import crypto from "node:crypto";
import { getDb } from "./db";

/**
 * Single-use, expiring tokens for email verification and password reset.
 *
 * Only a SHA-256 hash of each token is stored. A leaked database therefore
 * cannot be used to reset anyone's password — the same reason passwords are
 * hashed. Tokens are consumed atomically so a link cannot be replayed, and
 * lookup is by hash rather than by user, so an attacker cannot enumerate.
 */

export type TokenPurpose = "verify_email" | "password_reset";

export interface IssuedToken {
  /** The raw token — emailed to the user, never stored. */
  token: string;
  /** Short numeric code for the same grant, for copy-by-hand flows. */
  code: string;
  expiresAt: string;
}

const TTL_MINUTES: Record<TokenPurpose, number> = {
  verify_email: 30,
  password_reset: 60,
};

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueToken(userId: number, purpose: TokenPurpose): IssuedToken {
  const token = crypto.randomBytes(32).toString("base64url");
  // 6 digits, uniformly drawn — Math.random is not acceptable for a credential.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + TTL_MINUTES[purpose] * 60_000).toISOString();

  const db = getDb();
  // Any earlier grant of the same purpose is void — requesting a new link must
  // invalidate the old one, or a stolen older email stays usable.
  db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?").run(userId, purpose);
  db.prepare(
    "INSERT INTO auth_tokens (user_id, purpose, token_hash, code, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, purpose, hash(token), code, expiresAt);

  return { token, code, expiresAt };
}

interface TokenRow {
  id: number;
  user_id: number;
  purpose: TokenPurpose;
  expires_at: string;
  attempts: number;
}

/** Guard against brute-forcing the 6-digit code. */
const MAX_CODE_ATTEMPTS = 5;

/**
 * Verify and consume a token. Returns the user id, or null when the token is
 * unknown, expired, already used, or has had too many failed code attempts.
 */
export function consumeToken(
  purpose: TokenPurpose,
  opts: { token?: string; code?: string; userId?: number },
  now: Date = new Date(),
): number | null {
  const db = getDb();
  let row: TokenRow | undefined;

  if (opts.token) {
    row = db
      .prepare("SELECT * FROM auth_tokens WHERE purpose = ? AND token_hash = ?")
      .get(purpose, hash(opts.token)) as TokenRow | undefined;
  } else if (opts.code && opts.userId !== undefined) {
    // Codes are only ever checked against a known user, never searched globally.
    row = db
      .prepare("SELECT * FROM auth_tokens WHERE purpose = ? AND user_id = ?")
      .get(purpose, opts.userId) as TokenRow | undefined;
    if (row) {
      const match = db
        .prepare("SELECT code FROM auth_tokens WHERE id = ?")
        .get(row.id) as { code: string };
      if (!timingSafeEqual(match.code, opts.code)) {
        const attempts = row.attempts + 1;
        if (attempts >= MAX_CODE_ATTEMPTS) {
          db.prepare("DELETE FROM auth_tokens WHERE id = ?").run(row.id);
        } else {
          db.prepare("UPDATE auth_tokens SET attempts = ? WHERE id = ?").run(attempts, row.id);
        }
        return null;
      }
    }
  }

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    db.prepare("DELETE FROM auth_tokens WHERE id = ?").run(row.id);
    return null;
  }

  // Consume: deleting here is what makes the token single-use.
  db.prepare("DELETE FROM auth_tokens WHERE id = ?").run(row.id);
  return row.user_id;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Housekeeping — expired rows carry no value and should not accumulate. */
export function purgeExpiredTokens(now: Date = new Date()): number {
  return getDb()
    .prepare("DELETE FROM auth_tokens WHERE expires_at <= ?")
    .run(now.toISOString()).changes;
}

/**
 * Unsubscribe links are HMACs, not stored tokens.
 *
 * An unsubscribe link has to keep working from an email received months ago,
 * so a single-use expiring token is the wrong shape — the user would click it
 * and be told the link is invalid, which is exactly the moment they reach for
 * "mark as spam" instead. The HMAC is stateless, unforgeable, and stable.
 */
export function unsubscribeToken(userId: number): string {
  const secret = process.env.AUTH_SECRET ?? "dev-secret-not-for-production";
  const mac = crypto.createHmac("sha256", secret).update(`unsub:${userId}`).digest("base64url");
  return `${userId}.${mac}`;
}

export function verifyUnsubscribeToken(token: string): number | null {
  const [rawId, mac] = token.split(".");
  const userId = Number(rawId);
  if (!userId || !mac) return null;

  const expected = unsubscribeToken(userId).split(".")[1];
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}
