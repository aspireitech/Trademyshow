import crypto from "node:crypto";

/**
 * RFC 6238 time-based one-time passwords.
 *
 * Implemented directly rather than pulled in as a dependency — it is ~60 lines
 * of HMAC and base32, and it avoids trusting a third party with the code path
 * that guards every account.
 *
 * TOTP is preferred over SMS: no per-message cost, no SIM-swap exposure, and it
 * works offline.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
/** Accept the adjacent steps so a slightly wrong device clock still works. */
const DRIFT_STEPS = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeForStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function currentCode(secret: string, now: Date = new Date()): string {
  return codeForStep(secret, Math.floor(now.getTime() / 1000 / PERIOD_SECONDS));
}

/** Constant-time comparison across the accepted drift window. */
export function verifyCode(secret: string, submitted: string, now: Date = new Date()): boolean {
  const cleaned = submitted.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;

  const step = Math.floor(now.getTime() / 1000 / PERIOD_SECONDS);
  let matched = false;
  for (let i = -DRIFT_STEPS; i <= DRIFT_STEPS; i++) {
    const expected = Buffer.from(codeForStep(secret, step + i));
    const given = Buffer.from(cleaned);
    // Compare every candidate rather than returning early, so timing does not
    // reveal which step matched.
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) matched = true;
  }
  return matched;
}

/** otpauth:// URI for authenticator apps and QR codes. */
export function otpauthUrl(secret: string, email: string, issuer = "TradeMyShow"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Single-use recovery codes, for a lost authenticator. */
export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
}
