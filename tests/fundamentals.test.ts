/**
 * Fundamentals: the quoteSummary parser, the cache round-trip, and the
 * cache-only marketdata read (getFundamentals never calls a vendor itself —
 * that is marketrefresh's job).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.DB_PATH = ":memory:";

import { cacheFundamentals, cachedFundamentals } from "@/lib/providers/cache";
import { fetchFundamentals } from "@/lib/providers/yahoo";
import { getFundamentals } from "@/lib/marketdata";
import { resetDbForTests } from "@/lib/db";

beforeEach(() => {
  resetDbForTests();
  delete process.env.MARKET_DATA_PROVIDER;
});
afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

describe("fetchFundamentals", () => {
  it("maps a quoteSummary payload onto our shape", async () => {
    stubFetch({
      quoteSummary: {
        result: [
          {
            summaryDetail: {
              trailingPE: { raw: 32.1 },
              forwardPE: { raw: 28.4 },
              dividendRate: { raw: 1.0 },
              dividendYield: { raw: 0.0048 },
              exDividendDate: { raw: 1_760_000_000 },
            },
            defaultKeyStatistics: { trailingEps: { raw: 6.5 } },
            financialData: { profitMargins: { raw: 0.243 } },
            calendarEvents: { earnings: { earningsDate: [{ raw: 1_772_000_000 }, { raw: 1_780_000_000 }] } },
          },
        ],
      },
    });

    const f = await fetchFundamentals("AAPL");
    expect(f).toMatchObject({
      symbol: "AAPL",
      peRatioTrailing: 32.1,
      peRatioForward: 28.4,
      epsTrailing: 6.5,
      dividendPerShare: 1.0,
      dividendYieldPct: 0.48,
      profitMarginPct: 24.3,
    });
    // The earlier of the two candidate earnings dates, not just the first in the array.
    expect(f?.nextEarningsDate).toBe(new Date(1_772_000_000 * 1000).toISOString());
  });

  it("leaves a field null rather than guessing when the vendor omits it", async () => {
    stubFetch({ quoteSummary: { result: [{ summaryDetail: {} }] } });
    const f = await fetchFundamentals("PENNY");
    expect(f?.peRatioTrailing).toBeNull();
    expect(f?.nextEarningsDate).toBeNull();
  });

  it("returns null when the vendor has nothing for this symbol", async () => {
    stubFetch({ quoteSummary: { result: [] } });
    expect(await fetchFundamentals("ZZZZ")).toBeNull();
  });
});

describe("fundamentals cache", () => {
  const f = {
    symbol: "AAPL",
    peRatioTrailing: 32.1,
    peRatioForward: 28.4,
    epsTrailing: 6.5,
    dividendYieldPct: 0.48,
    dividendPerShare: 1.0,
    exDividendDate: "2025-10-01T00:00:00.000Z",
    nextEarningsDate: "2026-01-15T00:00:00.000Z",
    profitMarginPct: 24.3,
    fetchedAt: new Date().toISOString(),
  };

  it("round-trips a fundamentals record", () => {
    cacheFundamentals(f);
    expect(cachedFundamentals("AAPL")).toMatchObject({ peRatioTrailing: 32.1, epsTrailing: 6.5 });
  });

  it("expires past its staleness window", () => {
    cacheFundamentals({ ...f, fetchedAt: new Date(Date.now() - 8 * 24 * 3600_000).toISOString() });
    expect(cachedFundamentals("AAPL")).toBeNull();
  });

  it("getFundamentals reads the cache and never calls a vendor itself", () => {
    expect(getFundamentals("AAPL")).toBeNull();
    cacheFundamentals(f);
    expect(getFundamentals("AAPL")?.peRatioForward).toBe(28.4);
  });

  it("getFundamentals is null while the simulation is forced on, cache or not", () => {
    cacheFundamentals(f);
    process.env.MARKET_DATA_PROVIDER = "mock";
    expect(getFundamentals("AAPL")).toBeNull();
  });
});
