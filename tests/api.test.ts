/**
 * API integration tests: drive the real Next.js route handlers end-to-end
 * (register -> login -> groups -> holdings -> digest -> billing) against an
 * in-memory SQLite DB, with next/headers mocked by an in-memory cookie jar.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.CONTRACTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tms-api-"));
delete process.env.ANTHROPIC_API_KEY; // force the deterministic template writer

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as groups from "@/app/api/groups/route";
import * as groupById from "@/app/api/groups/[id]/route";
import * as holdings from "@/app/api/groups/[id]/holdings/route";
import * as digest from "@/app/api/groups/[id]/digest/route";
import * as search from "@/app/api/stocks/search/route";
import * as stock from "@/app/api/stocks/[symbol]/route";
import * as upgrade from "@/app/api/billing/upgrade/route";
import { getDb, getUserById } from "@/lib/db";
import { listContracts } from "@/lib/contracts";
import { TERMS_VERSION } from "@/lib/legal";

function jsonReq(url: string, body?: unknown, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const p = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

let groupId: number;

/** Move the signed-in account's trial into the past to test free-plan limits. */
function expireTrial(email: string): void {
  getDb()
    .prepare("UPDATE users SET trial_ends_at = ? WHERE email = ?")
    .run(new Date(Date.now() - 86_400_000).toISOString(), email);
}

describe("API flow: register → group → holdings → digest → upgrade", () => {
  beforeAll(() => {
    jar.clear();
  });

  it("rejects bad registrations", async () => {
    expect((await register.POST(jsonReq("/api/auth/register", { email: "x" }))).status).toBe(400);
    expect(
      (
        await register.POST(
          jsonReq("/api/auth/register", { email: "a@b.co", name: "A", password: "short", acceptTerms: true }),
        )
      ).status,
    ).toBe(400);
  });

  it("registers a user and sets a session", async () => {
    const res = await register.POST(
      jsonReq("/api/auth/register", {
        email: "alice@example.com", name: "Alice", password: "Str0ng!Pass2026",
        acceptTerms: true,
      }),
    );
    expect(res.status).toBe(201);
    expect(jar.has("tms_session")).toBe(true);
    const meRes = await me.GET();
    const data = (await meRes.json()) as { user: { email: string; plan: string } };
    expect(data.user.email).toBe("alice@example.com");
    expect(data.user.plan).toBe("free");
  });

  it("starts every new account on a no-card Pro trial", async () => {
    const res = await me.GET();
    const data = (await res.json()) as {
      trialing: boolean;
      effectivePlan: string;
      trialDaysRemaining: number;
      limits: { maxGroups: number };
    };
    expect(data.trialing).toBe(true);
    expect(data.effectivePlan).toBe("pro");
    expect(data.trialDaysRemaining).toBeGreaterThan(12);
    expect(data.limits.maxGroups).toBe(10);
  });

  it("rejects duplicate email and wrong password", async () => {
    const dup = await register.POST(
      jsonReq("/api/auth/register", {
        email: "alice@example.com", name: "A", password: "Str0ng!Pass2026", acceptTerms: true,
      }),
    );
    expect(dup.status).toBe(409);
    const bad = await login.POST(jsonReq("/api/auth/login", { email: "alice@example.com", password: "Wr0ng!Pass2026" }));
    expect(bad.status).toBe(401);
  });

  it("creates a group", async () => {
    const res = await groups.POST(jsonReq("/api/groups", { name: "AI & Chips" }));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { group: { id: number; name: string } };
    groupId = data.group.id;
    expect(data.group.name).toBe("AI & Chips");
  });

  it("allows extra watchlists while the trial is active", async () => {
    const res = await groups.POST(jsonReq("/api/groups", { name: "Second" }));
    expect(res.status).toBe(201);
  });

  it("falls back to free limits once the trial lapses", async () => {
    expireTrial("alice@example.com");
    const meRes = await me.GET();
    const meData = (await meRes.json()) as { trialing: boolean; effectivePlan: string };
    expect(meData.trialing).toBe(false);
    expect(meData.effectivePlan).toBe("free");

    const res = await groups.POST(jsonReq("/api/groups", { name: "Third" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/watchlist/i);
  });

  it("searches stocks and adds holdings", async () => {
    const s = await search.GET(new Request("http://localhost/api/stocks/search?q=nvda"));
    const found = (await s.json()) as { results: { symbol: string }[] };
    expect(found.results[0].symbol).toBe("NVDA");

    for (const symbol of ["NVDA", "AMD", "TSM"]) {
      const res = await holdings.POST(jsonReq(`/api/groups/${groupId}/holdings`, { symbol, quantity: 2 }), p(groupId));
      expect(res.status).toBe(201);
    }
  });

  it("rejects duplicates, unknown symbols, and enforces the free holdings cap", async () => {
    expect(
      (await holdings.POST(jsonReq(`/x`, { symbol: "NVDA" }), p(groupId))).status,
    ).toBe(409);
    expect((await holdings.POST(jsonReq(`/x`, { symbol: "NOPE" }), p(groupId))).status).toBe(400);
    // Free cap is 5; three are already held, so two more fit and the sixth fails.
    expect((await holdings.POST(jsonReq(`/x`, { symbol: "AAPL" }), p(groupId))).status).toBe(201);
    expect((await holdings.POST(jsonReq(`/x`, { symbol: "MSFT" }), p(groupId))).status).toBe(201);
    expect((await holdings.POST(jsonReq(`/x`, { symbol: "GOOGL" }), p(groupId))).status).toBe(403);
  });

  it("gates weekly insight behind a paid plan", async () => {
    const res = await digest.POST(
      new Request("http://localhost/x?period=weekly", { method: "POST" }),
      p(groupId),
    );
    expect(res.status).toBe(403);
  });

  it("returns group facts with weights and contributions", async () => {
    const res = await groupById.GET(new Request("http://localhost/x"), p(groupId));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      facts: { holdings: { weight: number; contributionPct: number }[]; changePct: number };
    };
    expect(data.facts.holdings).toHaveLength(5);
    const weightSum = data.facts.holdings.reduce((a, h) => a + h.weight, 0);
    expect(weightSum).toBeCloseTo(1, 2);
    const contribSum = data.facts.holdings.reduce((a, h) => a + h.contributionPct, 0);
    expect(contribSum).toBeCloseTo(data.facts.changePct, 1);
  });

  it("serves stock detail with trends for all timeframes", async () => {
    const res = await stock.GET(new Request("http://localhost/api/stocks/NVDA?range=3M"), {
      params: Promise.resolve({ symbol: "NVDA" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { trends: Record<string, number>; history: unknown[] };
    for (const tf of ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "YTD", "ALL"]) {
      expect(data.trends[tf]).toBeTypeOf("number");
    }
    expect(data.history.length).toBeGreaterThan(1);
  });

  it("generates and persists a digest (template writer)", async () => {
    const res = await digest.POST(new Request("http://localhost/x", { method: "POST" }), p(groupId));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { digest: { headline: string; body: string; writer: string } };
    expect(data.digest.writer).toBe("template");
    expect(data.digest.headline).toContain("AI & Chips");
    expect(data.digest.body.toLowerCase()).toContain("not investment advice");

    const latest = await digest.GET(new Request("http://localhost/x"), p(groupId));
    const stored = (await latest.json()) as { digest: { headline: string } };
    expect(stored.digest.headline).toBe(data.digest.headline);
  });

  it("rejects an unknown billing plan", async () => {
    const res = await upgrade.POST(jsonReq("/api/billing/upgrade", { plan: "platinum" }));
    expect(res.status).toBe(400);
  });

  it("upgrades to pro and lifts limits", async () => {
    const res = await upgrade.POST(jsonReq("/api/billing/upgrade", { plan: "pro" }));
    expect(res.status).toBe(200);
    const g2 = await groups.POST(jsonReq("/api/groups", { name: "Third" }));
    expect(g2.status).toBe(201);
    const add = await holdings.POST(jsonReq(`/x`, { symbol: "GOOGL" }), p(groupId));
    expect(add.status).toBe(201);
    const weekly = await digest.POST(
      new Request("http://localhost/x?period=weekly", { method: "POST" }),
      p(groupId),
    );
    expect(weekly.status).toBe(201);
  });

  it("blocks all API access without a session", async () => {
    jar.clear();
    expect((await groups.GET()).status).toBe(401);
    expect((await me.GET()).status).toBe(401);
    expect((await digest.POST(new Request("http://localhost/x", { method: "POST" }), p(groupId))).status).toBe(401);
    expect((await upgrade.POST(jsonReq("/api/billing/upgrade", { plan: "pro" }))).status).toBe(401);
  });
});

describe("terms acceptance is a precondition of an account existing", () => {
  const base = { email: "consent@example.com", name: "Consent", password: "Str0ng!Pass2026" };

  /**
   * Registration is rate limited per source address, and this block makes more
   * attempts than one address is allowed. Varying the address exercises the
   * real limiter instead of switching it off for tests.
   */
  let n = 0;
  const from = (body: unknown): Request =>
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": `203.0.113.${++n}` },
      body: JSON.stringify(body),
    });

  it("refuses registration without acceptance", async () => {
    const res = await register.POST(from(base));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Terms of Service/i);
  });

  it("refuses a falsy acceptance rather than coercing it", async () => {
    // "false", 0 and "" must not pass; only a real boolean true does.
    for (const acceptTerms of [false, 0, "true", null]) {
      const res = await register.POST(from({ ...base, acceptTerms }));
      expect(res.status).toBe(400);
    }
  });

  it("refuses acceptance of a superseded version of the terms", async () => {
    // A tab left open across a terms update must not silently record the user
    // as having accepted wording they never saw.
    const res = await register.POST(from({ ...base, acceptTerms: true, termsVersion: "1999-01-01.1" }));
    expect(res.status).toBe(409);
  });

  it("creates the account, the acceptance stamp and the contract together", async () => {
    const res = await register.POST(from({ ...base, acceptTerms: true, termsVersion: TERMS_VERSION }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { id: number }; contractId: string | null };
    expect(body.contractId).toMatch(/^TMS-/);

    const stored = getUserById(body.user.id)!;
    expect(stored.termsAcceptedAt).not.toBeNull();
    expect(stored.termsVersion).toBe(TERMS_VERSION);
    expect(listContracts(body.user.id)).toHaveLength(1);
  });
});
