/**
 * The live-data path: the cache that makes async vendor data readable
 * synchronously, and the adapter that fills it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";

import {
  cacheCloses, cacheNews, cacheQuote, cacheStats, cachedCloses,
  cachedNews, cachedQuote, quoteAgeHours,
} from "@/lib/providers/cache";
import { finnhubMarketData, finnhubNews } from "@/lib/providers/finnhub";
import { ProviderError } from "@/lib/providers/types";
import { getQuote, usingLiveData } from "@/lib/marketdata";
import { resetDbForTests } from "@/lib/db";

beforeEach(() => {
  resetDbForTests();
  delete process.env.MARKET_DATA_PROVIDER;
  delete process.env.FINNHUB_API_KEY;
});
afterEach(() => vi.unstubAllGlobals());

describe("quote cache", () => {
  const quote = { symbol: "AAPL", price: 200, prevClose: 198, changePct: 1.01 };

  it("round-trips a quote", () => {
    cacheQuote(quote);
    expect(cachedQuote("AAPL")).toMatchObject({ price: 200, prevClose: 198 });
  });

  it("is case-insensitive on the symbol", () => {
    cacheQuote(quote);
    expect(cachedQuote("aapl")).not.toBeNull();
  });

  it("overwrites rather than accumulating rows per symbol", () => {
    cacheQuote(quote);
    cacheQuote({ ...quote, price: 210 });
    expect(cachedQuote("AAPL")!.price).toBe(210);
    expect(cacheStats().quotes).toBe(1);
  });

  it("refuses a quote older than the freshness window", () => {
    // Stale prices are not "slightly wrong", they are wrong. Better to fall
    // through to the mock, which at least announces that it is generated.
    cacheQuote(quote, new Date(Date.now() - 48 * 3600_000));
    expect(cachedQuote("AAPL")).toBeNull();
  });

  it("reports the age of what it holds", () => {
    cacheQuote(quote, new Date(Date.now() - 3 * 3600_000));
    expect(quoteAgeHours("AAPL")).toBeCloseTo(3, 0);
    expect(quoteAgeHours("MSFT")).toBeNull();
  });
});

describe("close and news cache", () => {
  it("stores daily closes idempotently", () => {
    const points = [{ t: "2026-08-01", price: 10 }, { t: "2026-08-02", price: 11 }];
    cacheCloses("NVDA", points);
    cacheCloses("NVDA", points);
    expect(cachedCloses("NVDA", new Date("2026-07-01"))).toHaveLength(2);
  });

  it("returns closes in chronological order", () => {
    cacheCloses("NVDA", [{ t: "2026-08-03", price: 12 }, { t: "2026-08-01", price: 10 }]);
    expect(cachedCloses("NVDA", new Date("2026-01-01")).map((p) => p.t)).toEqual([
      "2026-08-01", "2026-08-03",
    ]);
  });

  it("filters news by recency and keeps the newest first", () => {
    cacheNews("AAPL", [
      { id: "a", symbol: "AAPL", headline: "Old", summary: "", source: "s", publishedAt: "2026-01-01T00:00:00Z", sentiment: "neutral", impact: 0.5 },
      { id: "b", symbol: "AAPL", headline: "New", summary: "", source: "s", publishedAt: "2026-08-18T00:00:00Z", sentiment: "positive", impact: 0.5 },
    ]);
    const recent = cachedNews("AAPL", new Date("2026-08-01"));
    expect(recent.map((n) => n.headline)).toEqual(["New"]);
  });
});

describe("live data is opt-in", () => {
  it("stays on the mock unless a provider is named", () => {
    expect(usingLiveData()).toBe(false);
    cacheQuote({ symbol: "AAPL", price: 999, prevClose: 998, changePct: 0.1 });
    // The cached 999 must be ignored while the provider is "mock", or tests
    // and the published track record would stop being reproducible.
    expect(getQuote("AAPL").price).not.toBe(999);
  });

  it("prefers a fresh cached quote once a provider is configured", () => {
    process.env.MARKET_DATA_PROVIDER = "finnhub";
    cacheQuote({ symbol: "AAPL", price: 999, prevClose: 998, changePct: 0.1 });
    expect(getQuote("AAPL").price).toBe(999);
  });

  it("keeps back-dated requests deterministic even with live data on", () => {
    // The track record grades scores at historical dates; letting a live quote
    // answer "what was the price in March" would rewrite published history.
    process.env.MARKET_DATA_PROVIDER = "finnhub";
    cacheQuote({ symbol: "AAPL", price: 999, prevClose: 998, changePct: 0.1 });
    expect(getQuote("AAPL", new Date("2026-03-02")).price).not.toBe(999);
  });
});

describe("finnhub adapter", () => {
  function stubFetch(body: unknown, status = 200) {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
  }

  it("requires a key before making a request", async () => {
    await expect(finnhubMarketData.fetchQuote("AAPL")).rejects.toBeInstanceOf(ProviderError);
  });

  it("maps a quote payload onto our shape", async () => {
    process.env.FINNHUB_API_KEY = "test";
    stubFetch({ c: 210.5, pc: 200, t: 1_770_000_000 });
    expect(await finnhubMarketData.fetchQuote("AAPL")).toMatchObject({
      symbol: "AAPL", price: 210.5, prevClose: 200, changePct: 5.25,
    });
  });

  it("treats an all-zero payload as an unknown symbol, not a price of zero", async () => {
    // Finnhub answers unknown symbols with zeroes rather than a 404; taking
    // that literally would render a stock as worth nothing.
    process.env.FINNHUB_API_KEY = "test";
    stubFetch({ c: 0, pc: 0, t: 0 });
    expect(await finnhubMarketData.fetchQuote("NOPE")).toBeNull();
  });

  it("marks a rate limit retryable and a bad key not retryable", async () => {
    process.env.FINNHUB_API_KEY = "test";
    stubFetch({}, 429);
    await expect(finnhubMarketData.fetchQuote("AAPL")).rejects.toMatchObject({ retryable: true });
    stubFetch({}, 401);
    await expect(finnhubMarketData.fetchQuote("AAPL")).rejects.toMatchObject({ retryable: false });
  });

  it("returns an empty history when the vendor reports no data", async () => {
    process.env.FINNHUB_API_KEY = "test";
    stubFetch({ s: "no_data" });
    expect(await finnhubMarketData.fetchDailyCloses("AAPL", 30)).toEqual([]);
  });

  it("classifies news sentiment with our own rules, not the vendor's", async () => {
    process.env.FINNHUB_API_KEY = "test";
    stubFetch([
      { id: 1, headline: "Company beats estimates", summary: "Strong growth", source: "Reuters", url: "https://x", datetime: 1_770_000_000 },
      { id: 2, headline: "Regulator opens probe", summary: "Shares drop", source: "AP", url: "https://y", datetime: 1_770_000_000 },
      { id: 3, headline: "Company names new director", summary: "", source: "PR", url: "https://z", datetime: 1_770_000_000 },
    ]);
    const items = await finnhubNews.fetchNews("AAPL", new Date("2026-08-01"), new Date("2026-08-08"));
    expect(items.map((i) => i.sentiment)).toEqual(["positive", "negative", "neutral"]);
    expect(items[0].url).toBe("https://x");
  });
});
