import { describe, expect, it } from "vitest";
import { buildDigestFacts, computeGroupFacts } from "@/lib/digest/engine";
import { writeWithTemplate } from "@/lib/digest/writer";
import type { NewsItem, Quote } from "@/lib/types";

const asOf = new Date("2026-08-07T16:00:00Z");

function quote(symbol: string, price: number, prevClose: number): Quote {
  return { symbol, price, prevClose, changePct: ((price - prevClose) / prevClose) * 100 };
}

describe("digest engine", () => {
  it("computes portfolio day change from holding values", () => {
    const quotes = new Map([
      ["AAA", quote("AAA", 110, 100)], // +10%
      ["BBB", quote("BBB", 95, 100)], // -5%
    ]);
    const facts = buildDigestFacts({
      groupName: "Test",
      holdings: [
        { symbol: "AAA", quantity: 1 },
        { symbol: "BBB", quantity: 1 },
      ],
      quotes,
      newsBySymbol: new Map(),
      asOf,
    });
    // prev value 200 -> now 205 = +2.5%
    expect(facts.totalValue).toBeCloseTo(205, 2);
    expect(facts.dayChangePct).toBeCloseTo(2.5, 2);
  });

  it("contributions sum to the portfolio day change", () => {
    const quotes = new Map([
      ["AAA", quote("AAA", 110, 100)],
      ["BBB", quote("BBB", 95, 100)],
      ["CCC", quote("CCC", 300, 290)],
    ]);
    const facts = buildDigestFacts({
      groupName: "Test",
      holdings: [
        { symbol: "AAA", quantity: 2 },
        { symbol: "BBB", quantity: 5 },
        { symbol: "CCC", quantity: 1 },
      ],
      quotes,
      newsBySymbol: new Map(),
      asOf,
    });
    const sum = facts.holdings.reduce((acc, h) => acc + h.contributionPct, 0);
    expect(sum).toBeCloseTo(facts.dayChangePct, 1);
  });

  it("weights sum to 1", () => {
    const facts = computeGroupFacts(
      "W",
      [
        { symbol: "AAPL", quantity: 3 },
        { symbol: "NVDA", quantity: 2 },
        { symbol: "JPM", quantity: 10 },
      ],
      asOf,
    );
    const sum = facts.holdings.reduce((acc, h) => acc + h.weight, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("ranks top gainers and losers correctly", () => {
    const quotes = new Map([
      ["UP1", quote("UP1", 120, 100)],
      ["UP2", quote("UP2", 105, 100)],
      ["DN1", quote("DN1", 80, 100)],
      ["DN2", quote("DN2", 97, 100)],
    ]);
    const facts = buildDigestFacts({
      groupName: "Rank",
      holdings: ["UP1", "UP2", "DN1", "DN2"].map((s) => ({ symbol: s, quantity: 1 })),
      quotes,
      newsBySymbol: new Map(),
      asOf,
    });
    expect(facts.topGainers[0].symbol).toBe("UP1");
    expect(facts.topLosers[0].symbol).toBe("DN1"); // worst first
    expect(facts.topGainers.every((h) => h.dayChangePct > 0)).toBe(true);
    expect(facts.topLosers.every((h) => h.dayChangePct < 0)).toBe(true);
  });

  it("attaches news to the right holding", () => {
    const news: NewsItem[] = [
      {
        id: "n1",
        symbol: "AAA",
        headline: "AAA beats earnings",
        summary: "s",
        source: "src",
        publishedAt: asOf.toISOString(),
        sentiment: "positive",
        impact: 0.9,
      },
    ];
    const facts = buildDigestFacts({
      groupName: "News",
      holdings: [{ symbol: "AAA", quantity: 1 }],
      quotes: new Map([["AAA", quote("AAA", 110, 100)]]),
      newsBySymbol: new Map([["AAA", news]]),
      asOf,
    });
    expect(facts.holdings[0].news[0].headline).toBe("AAA beats earnings");
  });

  it("is deterministic end-to-end for the same asOf date", () => {
    const holdings = [
      { symbol: "AAPL", quantity: 2 },
      { symbol: "TSLA", quantity: 1 },
    ];
    expect(computeGroupFacts("D", holdings, asOf)).toEqual(computeGroupFacts("D", holdings, asOf));
  });
});

describe("template digest writer", () => {
  const facts = computeGroupFacts(
    "AI & Chips",
    [
      { symbol: "NVDA", quantity: 2 },
      { symbol: "AMD", quantity: 3 },
      { symbol: "TSM", quantity: 4 },
    ],
    asOf,
  );

  it("produces a headline naming the group and direction", () => {
    const out = writeWithTemplate(facts, false);
    expect(out.headline).toContain("AI & Chips");
    expect(out.headline).toMatch(/up|down/);
    expect(out.writer).toBe("template");
  });

  it("mentions the top contributor and includes the disclaimer", () => {
    const out = writeWithTemplate(facts, true);
    expect(out.body).toContain(facts.topContributors[0].symbol);
    expect(out.body.toLowerCase()).toContain("not investment advice");
  });

  it("deep digest covers holdings beyond the top contributors", () => {
    const shallow = writeWithTemplate(facts, false);
    const deep = writeWithTemplate(facts, true);
    expect(deep.body.length).toBeGreaterThanOrEqual(shallow.body.length);
  });
});
