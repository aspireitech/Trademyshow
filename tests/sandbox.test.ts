/**
 * Sandbox mode. Its whole job is to make a public demo safe, so the tests are
 * about what it refuses to do.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  DEMO_ACCOUNT, guardExternalCharge, isSandbox,
  sandboxNotice, shouldSuppressEmail,
} from "@/lib/sandbox";

afterEach(() => {
  delete process.env.SANDBOX;
  delete process.env.SANDBOX_ALLOW_EMAIL;
  delete process.env.STRIPE_SECRET_KEY;
});

describe("isSandbox", () => {
  it("is off unless explicitly switched on", () => {
    expect(isSandbox()).toBe(false);
    process.env.SANDBOX = "1";
    // Only the exact string "true" counts — a sandbox is a production build,
    // and "truthy" is too easy to end up with by accident.
    expect(isSandbox()).toBe(false);
    process.env.SANDBOX = "true";
    expect(isSandbox()).toBe(true);
  });
});

describe("guardExternalCharge", () => {
  it("refuses a live Stripe key in sandbox mode", () => {
    process.env.SANDBOX = "true";
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    const guard = guardExternalCharge();
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toMatch(/live Stripe key/i);
  });

  it("permits a test key in sandbox mode", () => {
    process.env.SANDBOX = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    expect(guardExternalCharge().allowed).toBe(true);
  });

  it("does not interfere outside sandbox mode", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc123";
    expect(guardExternalCharge().allowed).toBe(true);
  });
});

describe("email suppression", () => {
  it("suppresses outbound mail in a sandbox by default", () => {
    process.env.SANDBOX = "true";
    expect(shouldSuppressEmail()).toBe(true);
  });

  it("can be overridden deliberately for delivery testing", () => {
    process.env.SANDBOX = "true";
    process.env.SANDBOX_ALLOW_EMAIL = "true";
    expect(shouldSuppressEmail()).toBe(false);
  });

  it("never suppresses mail in production", () => {
    expect(shouldSuppressEmail()).toBe(false);
  });
});

describe("the banner", () => {
  it("says the data is generated and that no card is charged", () => {
    // An unlabelled demo showing invented prices is how someone ends up
    // trading on numbers we made up.
    const notice = sandboxNotice();
    expect(notice.body).toMatch(/generated, not real market data/i);
    expect(notice.body).toMatch(/no card is charged/i);
    expect(notice.body).toMatch(/not make any financial decision/i);
  });

  it("carries the demo credentials so nobody has to be told them", () => {
    expect(sandboxNotice().demo.email).toBe(DEMO_ACCOUNT.email);
  });
});
