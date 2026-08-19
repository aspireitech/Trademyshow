/**
 * RFC 6238 TOTP. The vectors below are from the RFC's own appendix, which is
 * the only way to be sure an implementation interoperates with real
 * authenticator apps rather than merely agreeing with itself.
 */
import { describe, expect, it } from "vitest";

import {
  base32Decode,
  base32Encode,
  currentCode,
  generateRecoveryCodes,
  generateSecret,
  otpauthUrl,
  verifyCode,
} from "@/lib/totp";

describe("base32", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = Buffer.from("12345678901234567890");
    expect(Buffer.from(base32Decode(base32Encode(bytes))).equals(bytes)).toBe(true);
  });

  it("encodes the RFC test key to the expected alphabet", () => {
    const encoded = base32Encode(Buffer.from("12345678901234567890"));
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
  });

  it("tolerates lower case and padding on decode", () => {
    // Users paste keys out of authenticator apps in every possible casing.
    const upper = base32Encode(Buffer.from("secret"));
    expect(Buffer.from(base32Decode(upper.toLowerCase())).toString()).toBe("secret");
  });
});

describe("currentCode", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  it("matches the RFC 6238 vector for T=59", () => {
    expect(currentCode(secret, new Date(59_000))).toBe("287082");
  });

  it("matches the RFC 6238 vector for T=1111111109", () => {
    expect(currentCode(secret, new Date(1_111_111_109_000))).toBe("081804");
  });

  it("is stable across a 30-second step and changes at the boundary", () => {
    const a = currentCode(secret, new Date(60_000));
    expect(currentCode(secret, new Date(89_000))).toBe(a);
    expect(currentCode(secret, new Date(90_000))).not.toBe(a);
  });

  it("always returns six digits, zero-padded", () => {
    for (let t = 0; t < 20; t++) {
      expect(currentCode(secret, new Date(t * 30_000))).toMatch(/^\d{6}$/);
    }
  });
});

describe("verifyCode", () => {
  const secret = generateSecret();

  it("accepts the current code", () => {
    const now = new Date();
    expect(verifyCode(secret, currentCode(secret, now), now)).toBe(true);
  });

  it("accepts a code one step old", () => {
    // Clocks drift and people type slowly; rejecting the previous step turns
    // a working authenticator into a support ticket.
    const now = new Date(1_700_000_000_000);
    const prev = currentCode(secret, new Date(now.getTime() - 30_000));
    expect(verifyCode(secret, prev, now)).toBe(true);
  });

  it("rejects a code four steps old", () => {
    const now = new Date(1_700_000_000_000);
    const stale = currentCode(secret, new Date(now.getTime() - 120_000));
    expect(verifyCode(secret, stale, now)).toBe(false);
  });

  it("rejects malformed input without throwing", () => {
    expect(verifyCode(secret, "")).toBe(false);
    expect(verifyCode(secret, "abcdef")).toBe(false);
    expect(verifyCode(secret, "12345678")).toBe(false);
  });

  it("rejects a code from a different secret", () => {
    const other = generateSecret();
    const now = new Date();
    expect(verifyCode(secret, currentCode(other, now), now)).toBe(false);
  });
});

describe("enrolment helpers", () => {
  it("generates distinct secrets", () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });

  it("builds a scannable otpauth URL carrying the issuer", () => {
    const url = otpauthUrl("ABCDEFGH", "user@example.com");
    expect(url.startsWith("otpauth://totp/")).toBe(true);
    expect(url).toContain("secret=ABCDEFGH");
    expect(url.toLowerCase()).toContain("trademyshow");
  });

  it("issues unique recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes.length).toBeGreaterThanOrEqual(8);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
