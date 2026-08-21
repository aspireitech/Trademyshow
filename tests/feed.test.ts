/**
 * The real-data path: vendor adapters, the fallback chain, and the labels the
 * UI is allowed to print. These are the tests that matter most, because the
 * failure they guard against is not a crash — it is a made-up number shown as
 * though it were a quote.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";

import { resetDbForTests } from "@/lib/db";
import { cacheQuote, cacheQuoteStats, knownSymbol, searchDirectory } from "@/lib/providers/cache";
import {
  liveDataEnabled, marketDataChain, providerChoice, refreshMany, refreshSymbol,
  resolveSymbol, searchSymbols, sourceFor, sourceText,
} from "@/lib/providers/feed";
import { stooqSymbol } from "@/lib/providers/stooq";
import { classifyHeadline, yahooMarketData, yahooSearch } from "@/lib/providers/yahoo";

beforeEach(() => {
  resetDbForTests();
  delete process.env.MARKET_DATA_PROVIDER;
  delete process.env.FINNHUB_API_KEY;
});
afterEach(() => vi.unstubAllGlobals());

function stub(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

function chartBody(over: Record<string, unknown> = {}) {
  return {
    chart: {
      result: [
        {
          meta: {
            symbol: "AAPL",
            currency: "USD",
            fullExchangeName: "NasdaqGS",
            regularMarketPrice: 210,
            previousClose: 200,
            regularMarketDayHigh: 212,
            regularMarketDayLow: 205,
            regularMarketVolume: 51_000_000,
            fiftyTwoWeekHigh: 260,
            fiftyTwoWeekLow: 164,
            regularMarketTime: 1_760_000_000,
            ...over,
          },
          timestamp: [1_759_000_000, 1_759_086_400],
          indicators: { quote: [{ close: [198, 210], open: [197, 206] }] },
        },
      ],
    },
  };
}

describe("provider selection", () => {
  it("defaults to trying the live vendors", () => {
    expect(providerChoice()).toBe("auto");
    expect(liveDataEnabled()).toBe(true);
    expect(marketDataChain().map((p) => p.name)).toEqual(["yahoo", "stooq"]);
  });

  it("adds finnhub only when a key exists", () => {
    process.env.FINNHUB_API_KEY = "k";
    expect(marketDataChain().map((p) => p.name)).toContain("finnhub");
  });

  it("empties the chain when the simulation is forced on", () => {
    process.env.MARKET_DATA_PROVIDER = "mock";
    expect(marketDataChain()).toEqual([]);
    expect(liveDataEnabled()).toBe(false);
  });

  it("ignores a misspelled provider rather than serving nothing", () => {
    process.env.MARKET_DATA_PROVIDER = "yahooo";
    expect(providerChoice()).toBe("auto");
  });
});

describe("yahoo adapter", () => {
  it("reads the price and the previous close out of the chart meta", async () => {
    stub(chartBody());
    const quote = await yahooMarketData.fetchQuote("AAPL");
    expect(quote).toMatchObject({ symbol: "AAPL", price: 210, prevClose: 200, changePct: 5 });
  });

  it("returns the day and 52-week ranges alongside the quote", async () => {
    stub(chartBody());
    const res = await yahooMarketData.fetchQuoteWithStats!("AAPL");
    expect(res!.stats).toMatchObject({
      dayHigh: 212, dayLow: 205, volume: 51_000_000,
      fiftyTwoWeekHigh: 260, fiftyTwoWeekLow: 164, exchange: "NasdaqGS",
    });
    // The open comes from the bar, not the meta, and must line up with it.
    expect(res!.stats.open).toBe(197);
  });

  it("leaves market cap null rather than guessing one", async () => {
    stub(chartBody());
    const res = await yahooMarketData.fetchQuoteWithStats!("AAPL");
    expect(res!.stats.marketCap).toBeNull();
  });

  it("treats a missing previous close as no quote at all", async () => {
    stub(chartBody({ previousClose: undefined, chartPreviousClose: undefined }));
    expect(await yahooMarketData.fetchQuote("AAPL")).toBeNull();
  });

  it("drops null closes instead of drawing them as zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: { regularMarketPrice: 1, previousClose: 1 },
                  timestamp: [1_759_000_000, 1_759_086_400, 1_759_172_800],
                  indicators: { quote: [{ close: [100, null, 102] }] },
                },
              ],
            },
          }),
        ),
      ),
    );
    const closes = await yahooMarketData.fetchDailyCloses("AAPL", 30);
    expect(closes.map((c) => c.price)).toEqual([100, 102]);
  });

  it("keeps options and futures out of the type-ahead", async () => {
    stub({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
        { symbol: "AAPL250117C00150000", quoteType: "OPTION" },
        { symbol: "SPY", shortname: "SPDR S&P 500", quoteType: "ETF" },
      ],
    });
    const hits = await yahooSearch.search("aap", 10);
    expect(hits.map((h) => h.symbol)).toEqual(["AAPL", "SPY"]);
    expect(hits[1].assetClass).toBe("etf");
  });

  it("classifies headlines with our own word list, not the vendor's", () => {
    expect(classifyHeadline("Acme beats estimates and raises guidance")).toBe("positive");
    expect(classifyHeadline("Acme cuts outlook after probe")).toBe("negative");
    expect(classifyHeadline("Acme to present at a conference")).toBe("neutral");
  });
});

describe("stooq symbol mapping", () => {
  it("suffixes US listings and lowercases them", () => {
    expect(stooqSymbol("AAPL")).toBe("aapl.us");
  });

  it("hyphenates a class share", () => {
    expect(stooqSymbol("BRK.B")).toBe("brk-b.us");
  });

  it("quotes crypto as a pair", () => {
    expect(stooqSymbol("BTC-USD")).toBe("btcusd");
  });
});

describe("fallback chain", () => {
  it("moves to the next vendor when the first one throws", async () => {
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      call++;
      if (String(url).includes("yahoo")) return new Response("nope", { status: 500 });
      // Stooq: a daily CSV with two closes.
      return new Response("Date,Open,High,Low,Close,Volume\n2026-08-20,1,1,1,10\n2026-08-21,1,1,1,11\n");
    }));

    const res = await refreshSymbol("AAPL");
    expect(res.ok).toBe(true);
    expect(res.vendor).toBe("stooq");
    expect(call).toBeGreaterThan(1);
  });

  it("reports a failure rather than inventing a price when every vendor fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const res = await refreshSymbol("AAPL");
    expect(res.ok).toBe(false);
    expect(res.vendor).toBeNull();
    expect(res.error).toContain("yahoo");
  });
});

describe("a vendor that never answers", () => {
  it("stops at the budget instead of taking the timeout per symbol", async () => {
    // The failure this guards against is not slowness. A blackholed host makes
    // every request cost the full timeout, so 150 symbols becomes a refresh
    // that never returns and a page that never renders.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const started = Date.now();
    const results = await refreshMany(["AAPL", "MSFT", "NVDA", "AMZN"], {
      concurrency: 2,
      budgetMs: 0,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(results).toHaveLength(4);
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results.some((r) => r.error?.includes("budget"))).toBe(true);
  });

  it("cuts a request already in flight short, not just the queue behind it", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const started = Date.now();
    const results = await refreshMany(["AAPL"], { concurrency: 1, budgetMs: 150 });
    const elapsed = Date.now() - started;

    // Well under the adapters' own 12s timeout: the budget is what ended it.
    expect(elapsed).toBeLessThan(2000);
    expect(results[0].ok).toBe(false);
  });
});

describe("symbol resolution", () => {
  it("remembers a symbol the vendor confirmed, so the next lookup is local", async () => {
    stub({ quotes: [{ symbol: "APLM", shortname: "Apollomics, Inc.", quoteType: "EQUITY" }] });
    const info = await resolveSymbol("APLM");
    expect(info).toMatchObject({ symbol: "APLM", name: "Apollomics, Inc." });
    expect(knownSymbol("APLM")).not.toBeNull();
    expect(searchDirectory("APL").map((s) => s.symbol)).toContain("APLM");
  });

  it("refuses a symbol that is not a symbol", async () => {
    expect(await resolveSymbol("' OR 1=1 --")).toBeNull();
  });

  it("keeps local matches ahead of vendor ones and never duplicates", async () => {
    stub({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
        { symbol: "APLE", shortname: "Apple Hospitality REIT", quoteType: "EQUITY" },
      ],
    });
    const local = [{ symbol: "AAPL", name: "Apple Inc.", sector: "Technology" }];
    const { results } = await searchSymbols("apl", local, 10);
    expect(results[0].symbol).toBe("AAPL");
    expect(results.filter((r) => r.symbol === "AAPL")).toHaveLength(1);
    expect(results.map((r) => r.symbol)).toContain("APLE");
  });

  it("still answers from the local list when the vendor is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const local = [{ symbol: "AAPL", name: "Apple Inc.", sector: "Technology" }];
    const { results } = await searchSymbols("aap", local, 10);
    expect(results.map((r) => r.symbol)).toEqual(["AAPL"]);
  });
});

describe("what the UI is allowed to claim", () => {
  it("calls an uncached symbol simulated, not unknown", () => {
    const label = sourceFor("AAPL");
    expect(label.source).toBe("simulated");
    expect(sourceText(label)).toContain("Simulated");
  });

  it("calls a fresh cached quote delayed, and names the vendor", () => {
    process.env.MARKET_DATA_PROVIDER = "yahoo";
    cacheQuote({ symbol: "AAPL", price: 210, prevClose: 200, changePct: 5 });
    const label = sourceFor("AAPL");
    expect(label.source).toBe("delayed");
    expect(sourceText(label)).toContain("Yahoo Finance");
  });

  it("demotes a quote older than a trading day to an end-of-day close", () => {
    process.env.MARKET_DATA_PROVIDER = "yahoo";
    const old = new Date(Date.now() - 20 * 3600_000);
    cacheQuote({ symbol: "AAPL", price: 210, prevClose: 200, changePct: 5 }, old);
    cacheQuoteStats(
      {
        symbol: "AAPL", currency: "USD", exchange: "NasdaqGS", open: null, dayHigh: null,
        dayLow: null, volume: null, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null,
        marketCap: null, quoteTime: old.toISOString(),
      },
      old,
    );
    expect(sourceFor("AAPL").source).toBe("eod");
  });

  it("never claims live data while the simulation is forced on", () => {
    process.env.MARKET_DATA_PROVIDER = "mock";
    cacheQuote({ symbol: "AAPL", price: 210, prevClose: 200, changePct: 5 });
    expect(sourceFor("AAPL").source).toBe("simulated");
  });
});
