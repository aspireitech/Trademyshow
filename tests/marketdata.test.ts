import { describe, expect, it } from "vitest";
import {
  assetClassOf,
  getHistory,
  getQuote,
  rangeChangePct,
  searchStocks,
  UNIVERSE,
} from "@/lib/marketdata";
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

describe("multi-asset coverage", () => {
  it("covers funds and crypto, not only single stocks", () => {
    // A first watchlist is usually an index tracker plus a few names; a
    // universe of pure single stocks feels broken on day one.
    const classes = new Set(UNIVERSE.map((s) => s.assetClass ?? "stock"));
    expect(classes.has("etf")).toBe(true);
    expect(classes.has("crypto")).toBe(true);
  });

  it("defaults an ordinary equity to the stock class", () => {
    expect(assetClassOf("AAPL")).toBe("stock");
    expect(assetClassOf("SPY")).toBe("etf");
    expect(assetClassOf("BTC-USD")).toBe("crypto");
  });

  it("treats an unknown symbol as a stock rather than throwing", () => {
    expect(assetClassOf("NOPE")).toBe("stock");
  });

  it("prices and scores crypto through the same path as equities", () => {
    // One model, one set of promises — a separate crypto model would be a
    // second thing to defend in front of a regulator.
    const q = getQuote("BTC-USD");
    expect(q).not.toBeNull();
    expect(q!.price).toBeGreaterThan(0);
  });

  it("ranks an exact symbol match above a name match", () => {
    // "V" must find Visa, not be buried under Vanguard and VanEck.
    expect(searchStocks("V")[0].symbol).toBe("V");
  });

  it("finds funds by sector name", () => {
    expect(searchStocks("bonds").some((s) => s.symbol === "AGG")).toBe(true);
  });
});
