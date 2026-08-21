import crypto from "node:crypto";
import { getDb } from "./db";
import { isSandbox, shouldSuppressEmail } from "./sandbox";

/**
 * SMS one-time codes.
 *
 * Worth stating plainly: SMS is the weakest of the second factors offered
 * here. A SIM-swap defeats it, and the codes traverse networks nobody in this
 * system controls. TOTP — already implemented — is strictly stronger and
 * costs nothing to run. SMS exists because a large share of users will not
 * install an authenticator app, and a second factor they actually enable beats
 * a better one they decline.
 *
 * It is therefore offered as a recovery and verification channel, never as the
 * only thing standing between an attacker and an account.
 */

export type SmsResult = { ok: true; provider: string } | { ok: false; error: string };

function normaliseE164(raw: string): string | null {
  const trimmed = raw.replace(/[\s()-]/g, "");
  // Deliberately strict: a number stored in the wrong shape fails silently at
  // send time, months later, when someone needs the code to get back in.
  return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : null;
}

export function validPhone(raw: string): boolean {
  return normaliseE164(raw) !== null;
}

/** Only the last two digits survive for display. */
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(0, phone.length - 5))}${phone.slice(-2)}`;
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "Twilio is not configured" };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `Twilio responded ${res.status}` };
    return { ok: true, provider: "twilio" };
  } catch (err) {
    return { ok: false, error: `Twilio request failed: ${String(err)}` };
  }
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  // A sandbox must never send a real message: demo numbers belong to people
  // who did not ask to hear from us, and every send costs money.
  if (isSandbox() || shouldSuppressEmail()) {
    console.log(`\n──────── outbound SMS (suppressed) ────────\nTo: ${to}\n${body}\n───────────────────────────────────────────\n`);
    return { ok: true, provider: "console" };
  }
  if (process.env.TWILIO_ACCOUNT_SID) return sendViaTwilio(to, body);

  console.log(`\n──────── outbound SMS (no provider configured) ────────\nTo: ${to}\n${body}\n──────────────────────────────────────────────────────\n`);
  return { ok: true, provider: "console" };
}

// ---------- verification codes ----------

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

function hash(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export interface IssueResult {
  ok: boolean;
  error?: string;
  /** Returned only in sandbox, so a demo can be completed without a phone. */
  devCode?: string;
}

export async function issuePhoneCode(userId: number, rawPhone: string): Promise<IssueResult> {
  const phone = normaliseE164(rawPhone);
  if (!phone) {
    return { ok: false, error: "Enter the number in international format, e.g. +14155550123." };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  getDb()
    .prepare(
      "INSERT INTO phone_codes (user_id, phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)\n" +
        "ON CONFLICT(user_id) DO UPDATE SET phone = excluded.phone, code_hash = excluded.code_hash,\n" +
        "  expires_at = excluded.expires_at, attempts = 0",
    )
    .run(userId, phone, hash(code), new Date(Date.now() + CODE_TTL_MS).toISOString());

  const sent = await sendSms(phone, `${code} is your TradeMyShow verification code. It expires in 10 minutes.`);
  if (!sent.ok) return { ok: false, error: sent.error };

  return { ok: true, devCode: isSandbox() ? code : undefined };
}

export interface VerifyResult {
  ok: boolean;
  phone?: string;
  error?: string;
}

export function verifyPhoneCode(userId: number, code: string, now: Date = new Date()): VerifyResult {
  const db = getDb();
  const row = db.prepare("SELECT * FROM phone_codes WHERE user_id = ?").get(userId) as
    | { phone: string; code_hash: string; expires_at: string; attempts: number }
    | undefined;

  if (!row) return { ok: false, error: "Request a code first." };
  if (new Date(row.expires_at).getTime() <= now.getTime()) {
    db.prepare("DELETE FROM phone_codes WHERE user_id = ?").run(userId);
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  if (hash(code) !== row.code_hash) {
    const attempts = row.attempts + 1;
    // Six digits fall quickly to a script; the grant dies rather than the
    // attacker running out of patience.
    if (attempts >= MAX_ATTEMPTS) {
      db.prepare("DELETE FROM phone_codes WHERE user_id = ?").run(userId);
      return { ok: false, error: "Too many attempts. Request a new code." };
    }
    db.prepare("UPDATE phone_codes SET attempts = ? WHERE user_id = ?").run(attempts, userId);
    return { ok: false, error: "That code is not correct." };
  }

  db.transaction(() => {
    db.prepare("UPDATE users SET phone = ?, phone_verified_at = ? WHERE id = ?")
      .run(row.phone, now.toISOString(), userId);
    db.prepare("DELETE FROM phone_codes WHERE user_id = ?").run(userId);
  })();

  return { ok: true, phone: row.phone };
}

export function removePhone(userId: number): void {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE users SET phone = NULL, phone_verified_at = NULL WHERE id = ?").run(userId);
    db.prepare("DELETE FROM phone_codes WHERE user_id = ?").run(userId);
  })();
}
