import crypto from "node:crypto";
import { getDb, getUserByReferralCode, setUserPlan } from "./db";
import { PLAN_PRICING } from "./plans";
import type { Plan } from "./types";

/**
 * Billing.
 *
 * Stripe is called over plain HTTP rather than through the SDK — this needs
 * three endpoints, and the raw calls keep the dependency surface small and the
 * webhook signature check explicit.
 *
 * Without STRIPE_SECRET_KEY the module runs in stub mode: checkout resolves
 * immediately and the plan is applied directly, so the paid experience stays
 * testable with no account.
 */

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface CheckoutSession {
  url: string;
  stub: boolean;
}

export async function createCheckoutSession(
  userId: number,
  email: string,
  plan: Exclude<Plan, "free">,
  interval: "monthly" | "annual",
  successUrl: string,
  cancelUrl: string,
  promoCode?: string,
): Promise<CheckoutSession> {
  if (!stripeConfigured()) {
    // Stub: no card, no Stripe. The route applies the plan itself.
    return { url: `${successUrl}?stub=1`, stub: true };
  }

  const pricing = PLAN_PRICING[plan];
  const unitAmount = Math.round(
    (interval === "annual" ? pricing.annualUsd : pricing.monthlyUsd) * 100,
  );
  const discount = promoCode ? redeemablePercent(promoCode) : 0;
  const finalAmount = Math.round(unitAmount * (1 - discount / 100));

  const body = new URLSearchParams({
    mode: "subscription",
    customer_email: email,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(finalAmount),
    "line_items[0][price_data][recurring][interval]": interval === "annual" ? "year" : "month",
    "line_items[0][price_data][product_data][name]": `TradeMyShow ${plan[0].toUpperCase()}${plan.slice(1)}`,
    // Carried back on the webhook so the payment maps to an account.
    "metadata[user_id]": String(userId),
    "metadata[plan]": plan,
    "subscription_data[metadata][user_id]": String(userId),
    "subscription_data[metadata][plan]": plan,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`stripe checkout failed ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { url: string };
  return { url: json.url, stub: false };
}

/**
 * Verify a Stripe webhook signature (scheme v1, HMAC-SHA256 over
 * `timestamp.payload`). Without this check anyone who finds the endpoint can
 * grant themselves a paid plan.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now: Date = new Date(),
): boolean {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=", 2) as [string, string]),
  );
  const timestamp = Number(parts.t);
  const provided = parts.v1;
  if (!timestamp || !provided) return false;

  // Reject replays of an old but validly-signed payload.
  if (Math.abs(now.getTime() / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- promo codes ----------

interface PromoRow {
  code: string;
  percent_off: number;
  max_redemptions: number | null;
  redemptions: number;
  expires_at: string | null;
}

export interface PromoResult {
  valid: boolean;
  percentOff: number;
  reason?: string;
}

export function checkPromo(code: string, now: Date = new Date()): PromoResult {
  const row = getDb()
    .prepare("SELECT * FROM promo_codes WHERE code = ?")
    .get(code.trim().toUpperCase()) as PromoRow | undefined;

  if (!row) return { valid: false, percentOff: 0, reason: "That code is not recognised." };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return { valid: false, percentOff: 0, reason: "That code has expired." };
  }
  if (row.max_redemptions !== null && row.redemptions >= row.max_redemptions) {
    return { valid: false, percentOff: 0, reason: "That code has been fully redeemed." };
  }
  return { valid: true, percentOff: row.percent_off };
}

function redeemablePercent(code: string): number {
  const r = checkPromo(code);
  return r.valid ? r.percentOff : 0;
}

export function redeemPromo(code: string): void {
  getDb()
    .prepare("UPDATE promo_codes SET redemptions = redemptions + 1 WHERE code = ?")
    .run(code.trim().toUpperCase());
}

export function createPromo(
  code: string,
  percentOff: number,
  maxRedemptions?: number,
  expiresAt?: string,
): void {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO promo_codes (code, percent_off, max_redemptions, expires_at) VALUES (?, ?, ?, ?)",
    )
    .run(code.trim().toUpperCase(), percentOff, maxRedemptions ?? null, expiresAt ?? null);
}

// ---------- referrals ----------

/** Commission paid to the referrer on a referred account's first payment. */
export const REFERRAL_COMMISSION_PCT = 20;

export function attachReferral(referredUserId: number, referralCode: string): boolean {
  const referrer = getUserByReferralCode(referralCode.trim().toUpperCase());
  // Self-referral is the obvious abuse; block it explicitly.
  if (!referrer || referrer.id === referredUserId) return false;

  try {
    getDb()
      .prepare("INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)")
      .run(referrer.id, referredUserId);
    return true;
  } catch {
    // UNIQUE(referred_id) — an account can only ever be referred once.
    return false;
  }
}

/** Convert a pending referral once the referred account actually pays. */
export function convertReferral(referredUserId: number, paidCents: number): void {
  const commission = Math.round((paidCents * REFERRAL_COMMISSION_PCT) / 100);
  getDb()
    .prepare(
      "UPDATE referrals SET status = 'converted', commission_cents = ?, converted_at = datetime('now')\n" +
        "WHERE referred_id = ? AND status = 'pending'",
    )
    .run(commission, referredUserId);
}

export interface ReferralSummary {
  code: string | null;
  pending: number;
  converted: number;
  earnedCents: number;
}

export function referralSummary(userId: number, code: string | null): ReferralSummary {
  const row = getDb()
    .prepare(
      "SELECT\n" +
        "  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,\n" +
        "  SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS converted,\n" +
        "  COALESCE(SUM(commission_cents), 0) AS earned\n" +
        "FROM referrals WHERE referrer_id = ?",
    )
    .get(userId) as { pending: number | null; converted: number | null; earned: number };

  return {
    code,
    pending: row.pending ?? 0,
    converted: row.converted ?? 0,
    earnedCents: row.earned ?? 0,
  };
}

/** Apply a paid plan. Shared by the webhook and the stub path. */
export function applyPaidPlan(userId: number, plan: Plan): void {
  setUserPlan(userId, plan);
}
