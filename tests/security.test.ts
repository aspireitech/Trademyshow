/**
 * Security primitives: password strength, IP hashing, rate limiting, audit log.
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-for-security-tests";

import { audit, checkPassword, hashIp, RATE_LIMITS, rateLimit } from "@/lib/security";
import { createUser, getDb, resetDbForTests } from "@/lib/db";

beforeEach(() => resetDbForTests());

describe("checkPassword", () => {
  it("accepts a strong password", () => {
    expect(checkPassword("Str0ng!Pass2026").ok).toBe(true);
  });

  it("rejects short passwords", () => {
    const r = checkPassword("Ab1!xyz");
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/10/);
  });

  it("rejects common passwords even when they satisfy the character rules", () => {
    // The character classes pass; the fact that it is on every wordlist is
    // what makes it useless, and no amount of shape checking catches that.
    expect(checkPassword("Password123!").ok).toBe(false);
  });

  it("rejects a password containing the user's own email name", () => {
    expect(checkPassword("Jonathan!2026x", "jonathan@example.com").ok).toBe(false);
  });

  it("reports every problem at once rather than one at a time", () => {
    // A form that reveals one rule per submit is how people give up.
    expect(checkPassword("aaaa").problems.length).toBeGreaterThan(1);
  });
});

describe("hashIp", () => {
  it("is stable for the same address", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
  });

  it("differs between addresses and never returns the address itself", () => {
    const a = hashIp("203.0.113.9");
    expect(a).not.toBe(hashIp("203.0.113.10"));
    expect(a).not.toContain("203.0.113");
  });

  it("returns null for a missing address rather than hashing the empty string", () => {
    // Hashing "" would produce one shared bucket that looks like a real
    // fingerprint, silently rate-limiting unrelated callers together.
    expect(hashIp(null)).toBeNull();
  });
});

describe("rateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const rule = { limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", rule).allowed).toBe(true);
    }
    const blocked = rateLimit("k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps separate counters per key", () => {
    const rule = { limit: 1, windowSeconds: 60 };
    expect(rateLimit("a", rule).allowed).toBe(true);
    expect(rateLimit("b", rule).allowed).toBe(true);
  });

  it("lets the caller through again once the window rolls over", () => {
    const rule = { limit: 1, windowSeconds: 60 };
    const t0 = new Date("2026-01-01T00:00:00Z");
    expect(rateLimit("roll", rule, t0).allowed).toBe(true);
    expect(rateLimit("roll", rule, t0).allowed).toBe(false);
    // Next fixed window: the counter resets rather than carrying the block over.
    expect(rateLimit("roll", rule, new Date(t0.getTime() + 61_000)).allowed).toBe(true);
  });

  it("configures login more tightly than general API traffic", () => {
    // Credential stuffing is the attack that matters; browsing is not.
    expect(RATE_LIMITS.login.limit).toBeLessThan(RATE_LIMITS.api.limit);
  });
});

describe("audit", () => {
  it("records an event without storing a raw IP", async () => {
    const user = await createUser("audited@example.com", "Audited", "hash");
    const req = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "198.51.100.7", "user-agent": "vitest" },
    });
    audit(user.id, "login.success", "detail", req);

    const row = getDb().prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 1").get() as {
      action: string;
      ip_hash: string | null;
    };
    expect(row.action).toBe("login.success");
    expect(row.ip_hash).not.toContain("198.51.100");
  });
});

describe("audit resilience", () => {
  it("does not throw when the row cannot be written", () => {
    // A dangling user id violates the foreign key. Logging is a side-channel,
    // so the caller — a login, a password reset — must still succeed.
    expect(() => audit(999_999, "login.success")).not.toThrow();
  });
});
