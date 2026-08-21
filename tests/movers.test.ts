/**
 * Market movers. The property that matters is what these tables are NOT:
 * a ranking of what to buy.
 */
import { describe, expect, it } from "vitest";
import { marketBreadth, marketMovers } from "@/lib/insight/movers";
import { UNIVERSE } from "@/lib/marketdata";
import { articleCount, findCategory, HELP } from "@/lib/help";

const asOf = new Date("2026-08-14T16:00:00Z");

describe("marketMovers", () => {
  it("returns risers sorted by biggest gain", () => {
    const { gainers } = marketMovers(asOf, 6);
    expect(gainers.length).toBeGreaterThan(0);
    for (let i = 1; i < gainers.length; i++) {
      expect(gainers[i - 1].changePct).toBeGreaterThanOrEqual(gainers[i].changePct);
    }
    expect(gainers.every((m) => m.changePct > 0)).toBe(true);
  });

  it("returns fallers sorted by biggest loss", () => {
    const { losers } = marketMovers(asOf, 6);
    for (let i = 1; i < losers.length; i++) {
      expect(losers[i - 1].changePct).toBeLessThanOrEqual(losers[i].changePct);
    }
    expect(losers.every((m) => m.changePct < 0)).toBe(true);
  });

  it("never sorts by score", () => {
    // Ordering a public table by our own score would turn a factual list of
    // what moved into a ranking of what to buy.
    const { gainers } = marketMovers(asOf, 8);
    const scores = gainers.map((g) => g.score ?? 0);
    const sortedByScore = [...scores].sort((a, b) => b - a);
    expect(scores).not.toEqual(sortedByScore);
  });

  it("ranks biggest moves by magnitude, either direction", () => {
    const { mostActive } = marketMovers(asOf, 6);
    for (let i = 1; i < mostActive.length; i++) {
      expect(Math.abs(mostActive[i - 1].changePct)).toBeGreaterThanOrEqual(
        Math.abs(mostActive[i].changePct),
      );
    }
  });

  it("honours the limit and is deterministic for a given day", () => {
    expect(marketMovers(asOf, 3).gainers.length).toBeLessThanOrEqual(3);
    expect(marketMovers(asOf, 5)).toEqual(marketMovers(asOf, 5));
  });

  it("carries the asset class so a fund is not mistaken for a company", () => {
    const all = marketMovers(asOf, 20);
    const every = [...all.gainers, ...all.losers];
    expect(every.every((m) => ["stock", "etf", "crypto", "index"].includes(m.assetClass))).toBe(true);
  });
});

describe("marketBreadth", () => {
  it("accounts for every tracked instrument exactly once", () => {
    const b = marketBreadth(asOf);
    expect(b.advancing + b.declining + b.unchanged).toBe(UNIVERSE.length);
  });

  it("reports an average consistent with the direction of the day", () => {
    const b = marketBreadth(asOf);
    expect(Number.isFinite(b.averageChangePct)).toBe(true);
    if (b.advancing > b.declining * 2) expect(b.averageChangePct).toBeGreaterThan(-1);
  });
});

describe("help centre", () => {
  it("answers the advice question first, in the first category", () => {
    // Someone deciding whether to trust this should not have to hunt for it.
    expect(HELP[0].articles[0].q.toLowerCase()).toContain("recommend");
    expect(HELP[0].articles[0].a.join(" ")).toMatch(/^No\./);
  });

  it("states plainly that it cannot execute trades", () => {
    const all = HELP.flatMap((c) => c.articles).map((a) => a.a.join(" ")).join(" ");
    expect(all).toMatch(/do not execute orders/i);
  });

  it("gives every article a question and at least one paragraph", () => {
    for (const c of HELP) {
      expect(c.articles.length).toBeGreaterThan(0);
      for (const a of c.articles) {
        expect(a.q.endsWith("?") || a.q.endsWith(".")).toBe(true);
        expect(a.a.length).toBeGreaterThan(0);
        expect(a.a.every((p) => p.length > 20)).toBe(true);
      }
    }
  });

  it("counts its own articles and resolves categories by id", () => {
    expect(articleCount()).toBe(HELP.reduce((n, c) => n + c.articles.length, 0));
    expect(findCategory(HELP[0].id)?.title).toBe(HELP[0].title);
    expect(findCategory("nope")).toBeNull();
  });

  it("never promises an outcome anywhere in its answers", () => {
    const all = HELP.flatMap((c) => c.articles).map((a) => `${a.q} ${a.a.join(" ")}`).join(" ");
    // Checked sentence by sentence, because the phrases that matter appear
    // here inside denials — "not that the price will rise", "cannot guarantee
    // its accuracy". A flat regex over the whole text flags the disclaimers.
    const forbidden = [
      /\bwe recommend\b/i,
      /\bguarantee[ds]?\b/i,
      /\bwill (rise|fall|beat)\b/i,
      /\bprice target\b/i,
    ];
    const negated = /\b(not|never|no|nothing|cannot|can'?t|do not|don'?t|does not|doesn'?t|without)\b/i;

    const offenders = all
      .split(/(?<=[.?!])\s+/)
      .filter((sentence) => forbidden.some((r) => r.test(sentence)) && !negated.test(sentence));

    expect(offenders).toEqual([]);
  });
});
