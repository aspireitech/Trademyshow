/**
 * Social sign-in. The state signature is what stops login CSRF, and the
 * email_verified check is what stops account takeover, so both get tested
 * against the ways they actually fail.
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "test-secret-for-oauth-tests";
process.env.SITE_URL = "https://trademyshow.test";

import {
  authorizeUrl,
  decodeIdToken,
  enabledProviders,
  providerConfig,
  redirectUri,
  signState,
  verifyState,
} from "@/lib/oauth";

function idToken(claims: Record<string, unknown>): string {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APPLE_CLIENT_ID;
  delete process.env.APPLE_CLIENT_SECRET;
});

describe("provider gating", () => {
  it("offers nothing when no credentials are configured", () => {
    // A dead "Continue with Google" button is worse than no button.
    expect(enabledProviders()).toHaveLength(0);
    expect(providerConfig("google")).toBeNull();
  });

  it("offers a provider only once both halves of its credentials exist", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    expect(enabledProviders()).toHaveLength(0);
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    expect(enabledProviders().map((p) => p.id)).toEqual(["google"]);
  });

  it("builds a redirect URI on the canonical origin", () => {
    expect(redirectUri("google")).toBe("https://trademyshow.test/api/auth/oauth/google/callback");
  });
});

describe("authorizeUrl", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
  });

  it("returns null for an unconfigured provider", () => {
    expect(authorizeUrl("apple")).toBeNull();
  });

  it("includes the state, scope and redirect the provider needs", () => {
    const url = new URL(authorizeUrl("google")!);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("redirect_uri")).toBe(redirectUri("google"));
    expect(verifyState(url.searchParams.get("state"))).toMatchObject({ provider: "google" });
  });

  it("carries a referral code across the round trip", () => {
    const url = new URL(authorizeUrl("google", "REF123")!);
    expect(verifyState(url.searchParams.get("state"))?.ref).toBe("REF123");
  });
});

describe("state", () => {
  it("round-trips", () => {
    expect(verifyState(signState({ provider: "google" }))).toMatchObject({ provider: "google" });
  });

  it("rejects a tampered payload", () => {
    const [body, mac] = signState({ provider: "google" }).split(".");
    const forged = Buffer.from(
      JSON.stringify({ provider: "apple", exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(body).not.toBe(forged);
    expect(verifyState(`${forged}.${mac}`)).toBeNull();
  });

  it("rejects a missing or malformed state", () => {
    expect(verifyState(null)).toBeNull();
    expect(verifyState("")).toBeNull();
    expect(verifyState("no-dot")).toBeNull();
  });

  it("expires", () => {
    const state = signState({ provider: "google" });
    expect(verifyState(state, Date.now() + 3600_000)).toBeNull();
  });

  it("differs every time so a state cannot be pinned by an attacker", () => {
    expect(signState({ provider: "google" })).not.toBe(signState({ provider: "google" }));
  });
});

describe("decodeIdToken", () => {
  it("reads email and name from OIDC claims", () => {
    const id = decodeIdToken(
      idToken({ email: "Ada@Example.com", name: "Ada L", email_verified: true }),
    );
    expect(id).toMatchObject({ email: "ada@example.com", name: "Ada L", emailVerified: true });
  });

  it("accepts Apple's string form of email_verified", () => {
    expect(decodeIdToken(idToken({ email: "a@b.com", email_verified: "true" }))?.emailVerified).toBe(
      true,
    );
  });

  it("reports an unverified address as unverified", () => {
    // The callback refuses to link an account on this, which is what stops
    // takeover of an existing password account by asserting its address.
    expect(decodeIdToken(idToken({ email: "a@b.com" }))?.emailVerified).toBe(false);
    expect(
      decodeIdToken(idToken({ email: "a@b.com", email_verified: false }))?.emailVerified,
    ).toBe(false);
  });

  it("falls back to the local part when the provider sends no name", () => {
    expect(decodeIdToken(idToken({ email: "ada@example.com" }))?.name).toBe("ada");
  });

  it("returns null for a token with no email or a malformed shape", () => {
    expect(decodeIdToken(idToken({ sub: "123" }))).toBeNull();
    expect(decodeIdToken("not-a-jwt")).toBeNull();
    expect(decodeIdToken("a.b.c")).toBeNull();
  });
});
