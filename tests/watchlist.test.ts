/**
 * The two flows a visitor hits after deciding they want to keep a stock:
 * adding it to a list, and asking to be told when it moves. Both are the
 * moment the product asks for an account, so both have to be exactly right.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.CONTRACTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tms-wl-"));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

import * as register from "@/app/api/auth/register/route";
import * as watchlist from "@/app/api/watchlist/route";
import * as alerts from "@/app/api/alerts/route";
import * as newsletter from "@/app/api/newsletter/route";
import { getDb } from "@/lib/db";
import { runAlertJob } from "@/lib/jobs";
import { TERMS_VERSION } from "@/lib/legal";

/**
 * A request the way the browser sends one: JSON body, plus the CSRF token
 * echoed back out of the cookie jar. Omitting the header is exactly what a
 * cross-site forgery cannot do, so these routes reject it — which means a test
 * that forgets it is testing the CSRF check rather than the feature.
 */
function req(url: string, body?: unknown, method = "POST"): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = jar.get("tms_csrf");
  if (csrf) headers["x-csrf-token"] = csrf;
  return new Request(`http://localhost${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** DELETE with the same CSRF handling; there is no body to carry it in. */
function del(url: string): Request {
  const headers: Record<string, string> = {};
  const csrf = jar.get("tms_csrf");
  if (csrf) headers["x-csrf-token"] = csrf;
  return new Request(`http://localhost${url}`, { method: "DELETE", headers });
}

function expireTrial(email: string): void {
  getDb()
    .prepare("UPDATE users SET trial_ends_at = ? WHERE email = ?")
    .run(new Date(Date.now() - 86_400_000).toISOString(), email);
}

describe("adding a stock to a watchlist", () => {
  beforeAll(async () => {
    jar.clear();
    await register.POST(
      req("/api/auth/register", {
        email: "wl@example.com",
        password: "Str0ng!Passw0rd42",
        name: "WL",
        acceptTerms: true,
        termsVersion: TERMS_VERSION,
      }),
    );
  });

  it("tells a signed-out caller it is signed out rather than erroring", async () => {
    const saved = new Map(jar);
    jar.clear();
    const res = await watchlist.GET(new Request("http://localhost/api/watchlist?symbol=AAPL"));
    expect(res.status).toBe(200);
    expect((await res.json()).signedIn).toBe(false);
    for (const [k, v] of saved) jar.set(k, v);
  });

  it("creates the first list on its own rather than demanding one be named", async () => {
    // The first add is the moment that has to work with one click. Making the
    // visitor name a list before they can keep a stock loses them there.
    const res = await watchlist.POST(req("/api/watchlist", { symbol: "AAPL" }));
    expect(res.status).toBe(201);
    expect((await res.json()).listName).toBe("My watchlist");
  });

  it("reports membership so the button can show it is already on", async () => {
    const res = await watchlist.GET(new Request("http://localhost/api/watchlist?symbol=AAPL"));
    const data = (await res.json()) as { lists: { contains: boolean; count: number }[] };
    expect(data.lists[0].contains).toBe(true);
    expect(data.lists[0].count).toBe(1);
  });

  it("is idempotent — adding twice is not an error the visitor has to read", async () => {
    const res = await watchlist.POST(req("/api/watchlist", { symbol: "AAPL" }));
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyThere).toBe(true);
  });

  it("resolves a symbol outside the shipped universe before refusing it", async () => {
    expect((await watchlist.POST(req("/api/watchlist", { symbol: "NOTREAL" }))).status).toBe(400);
  });

  it("refuses a second list on the free plan, and says why", async () => {
    expireTrial("wl@example.com");
    const res = await watchlist.POST(req("/api/watchlist", { symbol: "MSFT", newListName: "Two" }));
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; upgrade: boolean };
    expect(body.upgrade).toBe(true);
    expect(body.error).toMatch(/watchlist/i);
  });

  it("removes a holding from the list it was added to", async () => {
    const res = await watchlist.DELETE(
      del("/api/watchlist?symbol=AAPL&listId=1"),
    );
    expect((await res.json()).ok).toBe(true);
  });

  it("will not delete from a list belonging to somebody else", async () => {
    const res = await watchlist.DELETE(
      del("/api/watchlist?symbol=AAPL&listId=9999"),
    );
    expect(res.status).toBe(404);
  });
});

describe("alerts", () => {
  beforeAll(async () => {
    jar.clear();
    await register.POST(
      req("/api/auth/register", {
        email: "alert@example.com",
        password: "Str0ng!Passw0rd42",
        name: "Al",
        acceptTerms: true,
        termsVersion: TERMS_VERSION,
      }),
    );
    expireTrial("alert@example.com");
  });

  it("accepts a price alert at any positive number", async () => {
    const res = await alerts.POST(
      req("/api/alerts", { symbol: "AAPL", kind: "price", direction: "above", threshold: 4800 }),
    );
    expect(res.status).toBe(201);
  });

  it("holds a score alert to the 0-100 range a score actually has", async () => {
    const res = await alerts.POST(
      req("/api/alerts", { symbol: "AAPL", kind: "score", direction: "above", threshold: 900 }),
    );
    expect(res.status).toBe(400);
  });

  it("gives the free plan a small allowance rather than none", async () => {
    // Zero alerts on the free tier means no reason to come back; three is
    // enough to form the habit and few enough to run out of.
    await alerts.POST(req("/api/alerts", { symbol: "MSFT", kind: "price", direction: "below", threshold: 100 }));
    await alerts.POST(req("/api/alerts", { symbol: "NVDA", kind: "score", direction: "above", threshold: 70 }));
    const res = await alerts.POST(
      req("/api/alerts", { symbol: "AMZN", kind: "price", direction: "above", threshold: 10 }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).upgrade).toBe(true);
  });

  it("fires a price alert and writes a notification pointing at the public page", () => {
    // The $10 "above" alert on MSFT is not it; the below-100 one is unlikely to
    // fire, so assert on the one certain to: price above 0.01.
    getDb().prepare("UPDATE alerts SET threshold = 0.01, direction = 'above', kind = 'price' WHERE symbol = 'MSFT'").run();
    const hits = runAlertJob();
    expect(hits.some((h) => h.symbol === "MSFT")).toBe(true);
    const note = getDb()
      .prepare("SELECT href, title FROM notifications WHERE title LIKE 'MSFT%' ORDER BY id DESC LIMIT 1")
      .get() as { href: string; title: string };
    // The link has to point at the public page, not the old /dashboard one:
    // an alert email that lands on a login screen is a wasted alert.
    expect(note.href).toBe("/stocks/MSFT");
  });

  it("lists alerts for one symbol with the plan's allowance attached", async () => {
    const res = await alerts.GET(new Request("http://localhost/api/alerts?symbol=AAPL"));
    const data = (await res.json()) as { alerts: unknown[]; limit: number };
    expect(data.alerts).toHaveLength(1);
    expect(data.limit).toBe(3);
  });
});

describe("newsletter", () => {
  it("takes an address without requiring an account", async () => {
    const res = await newsletter.POST(req("/api/newsletter", { email: "Reader@Example.com " }));
    expect(res.status).toBe(200);
    const row = getDb()
      .prepare("SELECT email FROM newsletter_subscribers WHERE email = ?")
      .get("reader@example.com");
    expect(row).toBeDefined();
  });

  it("refuses something that is not an address", async () => {
    expect((await newsletter.POST(req("/api/newsletter", { email: "nope" }))).status).toBe(400);
  });

  it("lets somebody re-subscribe after unsubscribing", async () => {
    await newsletter.DELETE(
      new Request("http://localhost/api/newsletter?email=reader@example.com", { method: "DELETE" }),
    );
    await newsletter.POST(req("/api/newsletter", { email: "reader@example.com" }));
    const row = getDb()
      .prepare("SELECT unsubscribed_at FROM newsletter_subscribers WHERE email = ?")
      .get("reader@example.com") as { unsubscribed_at: string | null };
    expect(row.unsubscribed_at).toBeNull();
  });

  it("does not reveal whether an address was ever on the list", async () => {
    const res = await newsletter.DELETE(
      new Request("http://localhost/api/newsletter?email=stranger@example.com", { method: "DELETE" }),
    );
    expect((await res.json()).ok).toBe(true);
  });
});
