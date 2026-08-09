import { describe, expect, it } from "vitest";
import { getHistory, getQuote, rangeChangePct, searchStocks, UNIVERSE } from "@/lib/marketdata";
import { TIMEFRAMES } from "@/lib/types";

const asOf = new Date("2026-08-07T16:00:00Z");

describe("mock market data provider", () => {
  it("is deterministic: same symbol + date gives identical quotes", () => {
    const a = getQuote("AAPL", asOf);
    const b = getQuote("AAPL", asOf);
    expect(a).toEqual(b);
  });

  it("different symbols give different series", () => {
    expect(getQuote("AAPL", asOf).price).not.toEqual(getQuote("MSFT", asOf).price);
  });

  it("quote change matches the last two closes", () => {
    const q = getQuote("NVDA", asOf);
    const expected = ((q.price - q.prevClose) / q.prevClose) * 100;
    expect(q.changePct).toBeCloseTo(expected, 1);
  });

  it("returns history for every timeframe, in chronological order", () => {
    for (const tf of TIMEFRAMES) {
      const hist = getHistory("TSLA", tf, asOf);
      expect(hist.length).toBeGreaterThan(1);
      const times = hist.map((p) => new Date(p.t).getTime());
      const sorted = [...times].sort((x, y) => x - y);
      expect(times).toEqual(sorted);
      for (const p of hist) expect(p.price).toBeGreaterThan(0);
    }
  });

  it("1D history ends at today's close", () => {
    const q = getQuote("AMZN", asOf);
    const intraday = getHistory("AMZN", "1D", asOf);
    expect(intraday[intraday.length - 1].price).toBeCloseTo(q.price, 2);
  });

  it("YTD starts near Jan 1 of the asOf year", () => {
    const hist = getHistory("MSFT", "YTD", asOf);
    expect(new Date(hist[0].t).getUTCFullYear()).toBe(2026);
    expect(new Date(hist[0].t).getUTCMonth()).toBeLessThanOrEqual(0);
  });

  it("rangeChangePct is consistent with history endpoints", () => {
    const hist = getHistory("META", "1Y", asOf);
    const expected = ((hist[hist.length - 1].price - hist[0].price) / hist[0].price) * 100;
    expect(rangeChangePct("META", "1Y", asOf)).toBeCloseTo(expected, 1);
  });

  it("search matches symbol prefix and name substring", () => {
    expect(searchStocks("aap")[0]?.symbol).toBe("AAPL");
    expect(searchStocks("micro").map((s) => s.symbol)).toContain("MSFT");
    expect(searchStocks("")).toEqual([]);
  });

  it("universe has no duplicate symbols", () => {
    const symbols = UNIVERSE.map((s) => s.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});
