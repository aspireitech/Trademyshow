/**
 * Single-use token issuance, consumption and the stateless unsubscribe HMAC.
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-for-token-tests";

import {
  consumeToken,
  issueToken,
  purgeExpiredTokens,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/tokens";
import { createUser, getDb, resetDbForTests } from "@/lib/db";

let userId: number;

beforeEach(async () => {
  resetDbForTests();
  userId = (await createUser("holder@example.com", "Holder", "hash")).id;
});

describe("issueToken", () => {
  it("stores only a hash, never the token itself", () => {
    const { token } = issueToken(userId, "password_reset");
    const row = getDb().prepare("SELECT token_hash FROM auth_tokens").get() as { token_hash: string };
    expect(row.token_hash).not.toBe(token);
    expect(row.token_hash).toHaveLength(64);
  });

  it("issues a six-digit code alongside the link", () => {
    expect(issueToken(userId, "verify_email").code).toMatch(/^\d{6}$/);
  });

  it("invalidates any earlier grant of the same purpose", () => {
    const first = issueToken(userId, "password_reset");
    issueToken(userId, "password_reset");
    // Otherwise an older intercepted email stays usable after the user
    // requests a fresh link, which is the whole point of requesting one.
    expect(consumeToken("password_reset", { token: first.token })).toBeNull();
  });

  it("keeps purposes independent", () => {
    const reset = issueToken(userId, "password_reset");
    issueToken(userId, "verify_email");
    expect(consumeToken("password_reset", { token: reset.token })).toBe(userId);
  });
});

describe("consumeToken", () => {
  it("returns the user id for a valid token", () => {
    const { token } = issueToken(userId, "password_reset");
    expect(consumeToken("password_reset", { token })).toBe(userId);
  });

  it("is single use", () => {
    const { token } = issueToken(userId, "password_reset");
    expect(consumeToken("password_reset", { token })).toBe(userId);
    expect(consumeToken("password_reset", { token })).toBeNull();
  });

  it("rejects a token used for the wrong purpose", () => {
    const { token } = issueToken(userId, "verify_email");
    expect(consumeToken("password_reset", { token })).toBeNull();
  });

  it("rejects an expired token", () => {
    const { token } = issueToken(userId, "password_reset");
    const later = new Date(Date.now() + 2 * 3600_000);
    expect(consumeToken("password_reset", { token }, later)).toBeNull();
  });

  it("accepts the six-digit code for a known user", () => {
    const { code } = issueToken(userId, "verify_email");
    expect(consumeToken("verify_email", { code, userId })).toBe(userId);
  });

  it("destroys the grant after repeated wrong codes", () => {
    const { code } = issueToken(userId, "verify_email");
    for (let i = 0; i < 5; i++) {
      expect(consumeToken("verify_email", { code: "000000", userId })).toBeNull();
    }
    // Brute force is cheap against six digits, so the grant must not survive.
    expect(consumeToken("verify_email", { code, userId })).toBeNull();
  });

  it("rejects an unknown token", () => {
    expect(consumeToken("password_reset", { token: "not-a-real-token" })).toBeNull();
  });
});

describe("purgeExpiredTokens", () => {
  it("removes only rows past their expiry", () => {
    issueToken(userId, "password_reset");
    expect(purgeExpiredTokens()).toBe(0);
    expect(purgeExpiredTokens(new Date(Date.now() + 2 * 3600_000))).toBe(1);
  });
});

describe("unsubscribe tokens", () => {
  it("round-trips", () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(42))).toBe(42);
  });

  it("rejects a tampered user id", () => {
    const [, mac] = unsubscribeToken(42).split(".");
    expect(verifyUnsubscribeToken(`43.${mac}`)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("stays valid on repeated use", () => {
    // An unsubscribe link in a months-old email must still work; a single-use
    // token here would produce "invalid link" at exactly the wrong moment.
    const t = unsubscribeToken(7);
    expect(verifyUnsubscribeToken(t)).toBe(7);
    expect(verifyUnsubscribeToken(t)).toBe(7);
  });
});
