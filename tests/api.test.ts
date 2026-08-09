/**
 * API integration tests: drive the real Next.js route handlers end-to-end
 * (register -> login -> groups -> holdings -> digest -> billing) against an
 * in-memory SQLite DB, with next/headers mocked by an in-memory cookie jar.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";
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

function jsonReq(url: string, body?: unknown, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const p = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

let groupId: number;

describe("API flow: register → group → holdings → digest → upgrade", () => {
  beforeAll(() => {
    jar.clear();
  });

  it("rejects bad registrations", async () => {
    expect((await register.POST(jsonReq("/api/auth/register", { email: "x" }))).status).toBe(400);
    expect(
      (
        await register.POST(
          jsonReq("/api/auth/register", { email: "a@b.co", name: "A", password: "short" }),
        )
      ).status,
    ).toBe(400);
  });

  it("registers a user and sets a session", async () => {
    const res = await register.POST(
      jsonReq("/api/auth/register", { email: "alice@example.com", name: "Alice", password: "password123" }),
    );
    expect(res.status).toBe(201);
    expect(jar.has("tms_session")).toBe(true);
    const meRes = await me.GET();
    const data = (await meRes.json()) as { user: { email: string; plan: string } };
    expect(data.user.email).toBe("alice@example.com");
    expect(data.user.plan).toBe("free");
  });

  it("rejects duplicate email and wrong password", async () => {
    const dup = await register.POST(
      jsonReq("/api/auth/register", { email: "alice@example.com", name: "A", password: "password123" }),
    );
    expect(dup.status).toBe(409);
    const bad = await login.POST(jsonReq("/api/auth/login", { email: "alice@example.com", password: "wrongpass1" }));
    expect(bad.status).toBe(401);
  });

  it("creates a group", async () => {
    const res = await groups.POST(jsonReq("/api/groups", { name: "AI & Chips" }));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { group: { id: number; name: string } };
    groupId = data.group.id;
    expect(data.group.name).toBe("AI & Chips");
  });

  it("enforces the free-plan group limit", async () => {
    const res = await groups.POST(jsonReq("/api/groups", { name: "Second" }));
    expect(res.status).toBe(403);
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
    // 3 holdings already = free cap
    expect((await holdings.POST(jsonReq(`/x`, { symbol: "AAPL" }), p(groupId))).status).toBe(403);
  });

  it("returns group facts with weights and contributions", async () => {
    const res = await groupById.GET(new Request("http://localhost/x"), p(groupId));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      facts: { holdings: { weight: number; contributionPct: number }[]; dayChangePct: number };
    };
    expect(data.facts.holdings).toHaveLength(3);
    const weightSum = data.facts.holdings.reduce((a, h) => a + h.weight, 0);
    expect(weightSum).toBeCloseTo(1, 2);
    const contribSum = data.facts.holdings.reduce((a, h) => a + h.contributionPct, 0);
    expect(contribSum).toBeCloseTo(data.facts.dayChangePct, 1);
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

  it("upgrades to pro and lifts limits", async () => {
    const res = await upgrade.POST();
    expect(res.status).toBe(200);
    const g2 = await groups.POST(jsonReq("/api/groups", { name: "Second" }));
    expect(g2.status).toBe(201);
    const add = await holdings.POST(jsonReq(`/x`, { symbol: "AAPL" }), p(groupId));
    expect(add.status).toBe(201);
  });

  it("blocks all API access without a session", async () => {
    jar.clear();
    expect((await groups.GET()).status).toBe(401);
    expect((await me.GET()).status).toBe(401);
    expect((await digest.POST(new Request("http://localhost/x", { method: "POST" }), p(groupId))).status).toBe(401);
  });
});
