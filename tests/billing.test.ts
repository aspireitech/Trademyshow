/**
 * Webhook signature verification, promo codes and the referral ledger.
 */
import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";

import {
  attachReferral,
  checkPromo,
  convertReferral,
  createPromo,
  redeemPromo,
  referralSummary,
  REFERRAL_COMMISSION_PCT,
  verifyStripeSignature,
} from "@/lib/billing";
import { createUser, resetDbForTests, setReferralCode } from "@/lib/db";

beforeEach(() => resetDbForTests());

// ---------- webhook signatures ----------

const SECRET = "whsec_test";

function sign(payload: string, at: Date, secret = SECRET): string {
  const t = Math.floor(at.getTime() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

describe("verifyStripeSignature", () => {
  const now = new Date("2026-03-01T12:00:00Z");
  const payload = JSON.stringify({ type: "checkout.session.completed" });

  it("accepts a correctly signed payload", () => {
    expect(verifyStripeSignature(payload, sign(payload, now), SECRET, 300, now)).toBe(true);
  });

  it("rejects a missing header", () => {
    expect(verifyStripeSignature(payload, null, SECRET, 300, now)).toBe(false);
  });

  it("rejects a payload modified after signing", () => {
    // The whole point: without this, anyone posting to the endpoint could
    // grant themselves a paid plan.
    const header = sign(payload, now);
    const tampered = JSON.stringify({ type: "checkout.session.completed", plan: "premium" });
    expect(verifyStripeSignature(tampered, header, SECRET, 300, now)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyStripeSignature(payload, sign(payload, now, "wrong"), SECRET, 300, now)).toBe(false);
  });

  it("rejects a replay of an old but validly signed payload", () => {
    const old = new Date(now.getTime() - 3600_000);
    expect(verifyStripeSignature(payload, sign(payload, old), SECRET, 300, now)).toBe(false);
  });

  it("rejects a malformed header without throwing", () => {
    expect(verifyStripeSignature(payload, "garbage", SECRET, 300, now)).toBe(false);
    expect(verifyStripeSignature(payload, "t=,v1=", SECRET, 300, now)).toBe(false);
  });
});

// ---------- promo codes ----------

describe("promo codes", () => {
  it("validates a live code regardless of the casing typed", () => {
    createPromo("LAUNCH30", 30);
    expect(checkPromo("launch30")).toMatchObject({ valid: true, percentOff: 30 });
    expect(checkPromo("  LaUnCh30 ")).toMatchObject({ valid: true });
  });

  it("rejects an unknown code", () => {
    expect(checkPromo("NOPE").valid).toBe(false);
  });

  it("rejects an expired code", () => {
    createPromo("OLD", 50, undefined, "2020-01-01T00:00:00Z");
    expect(checkPromo("OLD")).toMatchObject({ valid: false });
  });

  it("stops accepting a code once it is fully redeemed", () => {
    createPromo("FIRST10", 10, 1);
    expect(checkPromo("FIRST10").valid).toBe(true);
    redeemPromo("FIRST10");
    expect(checkPromo("FIRST10")).toMatchObject({ valid: false });
  });

  it("gives a reason the UI can show instead of a bare false", () => {
    expect(checkPromo("NOPE").reason).toBeTruthy();
  });
});

// ---------- referrals ----------

async function twoUsers() {
  const referrer = await createUser("ref@example.com", "Referrer", "hash");
  const referred = await createUser("new@example.com", "Newcomer", "hash");
  setReferralCode(referrer.id, "REF123");
  return { referrer, referred };
}

describe("referrals", () => {
  it("attaches a referred account to the referrer", async () => {
    const { referrer, referred } = await twoUsers();
    expect(attachReferral(referred.id, "ref123")).toBe(true);
    expect(referralSummary(referrer.id, "REF123").pending).toBe(1);
  });

  it("refuses self-referral", async () => {
    const { referrer } = await twoUsers();
    expect(attachReferral(referrer.id, "REF123")).toBe(false);
  });

  it("refuses an unknown code", async () => {
    const { referred } = await twoUsers();
    expect(attachReferral(referred.id, "MADEUP")).toBe(false);
  });

  it("only ever credits one referrer per account", async () => {
    const { referred } = await twoUsers();
    const second = await createUser("other@example.com", "Other", "hash");
    setReferralCode(second.id, "OTHER1");
    expect(attachReferral(referred.id, "REF123")).toBe(true);
    expect(attachReferral(referred.id, "OTHER1")).toBe(false);
  });

  it("pays commission only when the referred account actually pays", async () => {
    const { referrer, referred } = await twoUsers();
    attachReferral(referred.id, "REF123");

    expect(referralSummary(referrer.id, "REF123").earnedCents).toBe(0);
    convertReferral(referred.id, 1200);

    const after = referralSummary(referrer.id, "REF123");
    expect(after.converted).toBe(1);
    expect(after.pending).toBe(0);
    expect(after.earnedCents).toBe((1200 * REFERRAL_COMMISSION_PCT) / 100);
  });

  it("does not pay twice for the same conversion", async () => {
    const { referrer, referred } = await twoUsers();
    attachReferral(referred.id, "REF123");
    convertReferral(referred.id, 1200);
    convertReferral(referred.id, 1200);
    expect(referralSummary(referrer.id, "REF123").earnedCents).toBe(240);
  });

  it("reports zeroes for someone who has referred nobody", async () => {
    const { referrer } = await twoUsers();
    expect(referralSummary(referrer.id, "REF123")).toMatchObject({
      pending: 0,
      converted: 0,
      earnedCents: 0,
    });
  });
});
