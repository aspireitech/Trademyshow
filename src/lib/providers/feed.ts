import {
  cacheCloses, cacheNews, cacheQuote, cacheQuoteStats, cachedQuote, cachedQuoteStats,
  knownSymbol, quoteAgeHours, rememberSymbol, searchDirectory,
} from "./cache";
import { finnhubMarketData, finnhubNews } from "./finnhub";
import { stooqMarketData } from "./stooq";
import { yahooMarketData, yahooNews, yahooSearch } from "./yahoo";
import type { MarketDataProvider, NewsProvider, SearchProvider } from "./types";
import type { DataSource, PricePoint, SourceLabel, StockInfo } from "../types";

/**
 * Which vendors are in play, in what order, and what the site is allowed to
 * claim about the numbers they return.
 *
 * The ordering is the whole design. A single vendor is a single point of
 * failure, and the failure mode that matters is not an outage — it is a page
 * that silently shows invented prices as though they were real. So: try the
 * live feed, fall back to a different operator's end-of-day file, and only
 * then fall back to the simulation, which every screen labels as simulated.
 * At no point does a number change its label to suit the layout.
 */

export type ProviderChoice = "auto" | "yahoo" | "stooq" | "finnhub" | "mock";

export function providerChoice(): ProviderChoice {
  const raw = (process.env.MARKET_DATA_PROVIDER ?? "auto").trim().toLowerCase();
  return (["auto", "yahoo", "stooq", "finnhub", "mock"] as const).includes(raw as ProviderChoice)
    ? (raw as ProviderChoice)
    : "auto";
}

/** True when anything other than the simulation is allowed to answer. */
export function liveDataEnabled(): boolean {
  return providerChoice() !== "mock";
}

/**
 * The vendors to try, in order. Finnhub is only ever included when a key is
 * present: a keyless call to it burns a round trip to learn what the
 * environment already knew.
 */
export function marketDataChain(): MarketDataProvider[] {
  const choice = providerChoice();
  if (choice === "mock") return [];
  if (choice === "yahoo") return [yahooMarketData];
  if (choice === "stooq") return [stooqMarketData];
  if (choice === "finnhub") return [finnhubMarketData];
  const chain: MarketDataProvider[] = [yahooMarketData, stooqMarketData];
  if (process.env.FINNHUB_API_KEY) chain.push(finnhubMarketData);
  return chain;
}

export function newsChain(): NewsProvider[] {
  const choice = providerChoice();
  if (choice === "mock") return [];
  if (choice === "finnhub") return process.env.FINNHUB_API_KEY ? [finnhubNews] : [];
  const chain: NewsProvider[] = [yahooNews];
  if (process.env.FINNHUB_API_KEY) chain.push(finnhubNews);
  return chain;
}

export function searchChain(): SearchProvider[] {
  return providerChoice() === "mock" ? [] : [yahooSearch];
}

// ---------- fetching ----------

export interface RefreshResult {
  symbol: string;
  ok: boolean;
  vendor: string | null;
  error: string | null;
}

/** How much daily history one refresh pulls: enough for the 5Y chart. */
const HISTORY_DAYS = 5 * 365 + 30;

/**
 * Fetch one instrument from the first vendor that answers, and write what came
 * back into the cache.
 *
 * `withHistory` is separate because the two have different natural rhythms: a
 * price is stale in minutes, five years of closes are stale once a day. Asking
 * for the history on every quote refresh would multiply the traffic by a
 * hundred for data that did not change.
 */
export async function refreshSymbol(
  symbol: string,
  { withHistory = false }: { withHistory?: boolean } = {},
): Promise<RefreshResult> {
  const errors: string[] = [];

  for (const provider of marketDataChain()) {
    try {
      let wrote = false;

      if (provider.fetchQuoteWithStats) {
        const res = await provider.fetchQuoteWithStats(symbol);
        if (res) {
          cacheQuote(res.quote);
          cacheQuoteStats(res.stats);
          wrote = true;
        }
      } else {
        const quote = await provider.fetchQuote(symbol);
        if (quote) {
          cacheQuote(quote);
          wrote = true;
        }
      }

      if (withHistory) {
        const closes = await provider.fetchDailyCloses(symbol, HISTORY_DAYS);
        if (closes.length > 1) {
          cacheCloses(symbol, closes);
          wrote = true;
        }
      }

      if (wrote) return { symbol, ok: true, vendor: provider.name, error: null };
      errors.push(`${provider.name}: no data`);
    } catch (err) {
      errors.push(`${provider.name}: ${(err as Error).message}`);
    }
  }

  return {
    symbol,
    ok: false,
    vendor: null,
    error: errors.join("; ") || "no provider configured",
  };
}

/** Fetch and cache recent headlines for one symbol. */
export async function refreshNews(symbol: string, days = 5): Promise<boolean> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  for (const provider of newsChain()) {
    try {
      const items = await provider.fetchNews(symbol, from, to);
      if (items.length > 0) {
        cacheNews(symbol, items);
        return true;
      }
    } catch {
      // A missing news feed must never take the price down with it.
    }
  }
  return false;
}

/**
 * Refresh many symbols with a bounded number of requests in flight.
 *
 * Unbounded Promise.all over 150 symbols is what gets an IP rate-limited
 * within a minute, and a rate-limited feed is indistinguishable from no feed.
 * Six at a time is roughly what a person with several tabs open generates.
 */
export async function refreshMany(
  symbols: string[],
  {
    withHistory = false,
    concurrency = 6,
    budgetMs = 180_000,
  }: { withHistory?: boolean; concurrency?: number; budgetMs?: number } = {},
): Promise<RefreshResult[]> {
  const queue = [...symbols];
  const results: RefreshResult[] = [];
  const deadline = Date.now() + budgetMs;

  /**
   * A wall-clock budget, not just a per-request timeout.
   *
   * When a vendor is not merely slow but unreachable — DNS blackholed, a
   * firewall dropping packets rather than refusing them — every symbol costs
   * the full timeout, and 150 of those is a request that never returns. The
   * budget bounds both the queue and each call in flight, so the caller gets
   * partial results and an honest count of failures instead of hanging.
   */
  function withinBudget(symbol: string): Promise<RefreshResult> {
    const remaining = deadline - Date.now();
    const exhausted: RefreshResult = {
      symbol, ok: false, vendor: null, error: "refresh budget exhausted",
    };
    if (remaining <= 0) return Promise.resolve(exhausted);

    return Promise.race([
      refreshSymbol(symbol, { withHistory }),
      new Promise<RefreshResult>((resolve) => {
        const timer = setTimeout(() => resolve(exhausted), remaining);
        // Do not hold a Node process open for a timer that only exists to cut
        // a request short.
        timer.unref?.();
      }),
    ]);
  }

  async function worker(): Promise<void> {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      results.push(await withinBudget(next));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, symbols.length) }, worker));
  return results;
}

// ---------- symbol resolution and search ----------

/**
 * Turn something a visitor typed into an instrument we can show a page for.
 *
 * Order matters: the local directory answers without a network call, and the
 * vendor is asked only for symbols nobody has looked up before. A symbol the
 * vendor confirms is remembered, so the second visitor is served locally.
 */
export async function resolveSymbol(symbol: string): Promise<StockInfo | null> {
  const upper = symbol.trim().toUpperCase();
  if (!upper || !/^[A-Z0-9.\-^]{1,15}$/.test(upper)) return null;

  const known = knownSymbol(upper);
  if (known) return known;

  for (const provider of searchChain()) {
    try {
      const hits = await provider.search(upper, 10);
      const exact = hits.find((h) => h.symbol.toUpperCase() === upper);
      if (exact) {
        rememberSymbol(exact, provider.name);
        return exact;
      }
    } catch {
      // Fall through: an unresolvable symbol is a 404, not a 500.
    }
  }
  return null;
}

/**
 * Type-ahead across the whole market.
 *
 * Local matches come back first and instantly — the names most people type are
 * in the universe — and the vendor fills the rest of the list. A vendor
 * failure degrades the dropdown to local results rather than emptying it.
 */
export async function searchSymbols(
  query: string,
  local: StockInfo[],
  limit = 10,
): Promise<{ results: StockInfo[]; vendorUsed: string | null }> {
  const seen = new Set(local.map((s) => s.symbol.toUpperCase()));
  const results = [...local];

  for (const hit of searchDirectory(query, limit)) {
    if (seen.has(hit.symbol.toUpperCase())) continue;
    seen.add(hit.symbol.toUpperCase());
    results.push(hit);
  }

  if (results.length >= limit) return { results: results.slice(0, limit), vendorUsed: null };

  for (const provider of searchChain()) {
    try {
      const hits = await provider.search(query, limit);
      for (const hit of hits) {
        if (seen.has(hit.symbol.toUpperCase())) continue;
        seen.add(hit.symbol.toUpperCase());
        rememberSymbol(hit, provider.name);
        results.push(hit);
      }
      if (hits.length > 0) return { results: results.slice(0, limit), vendorUsed: provider.name };
    } catch {
      // Keep whatever the local pass found.
    }
  }

  return { results: results.slice(0, limit), vendorUsed: null };
}

// ---------- provenance ----------

/**
 * What the site is entitled to say about the number it is about to show.
 *
 * Called by every screen that prints a price. There is deliberately no
 * "unknown" state: if nothing real is cached, the answer is "simulated", and
 * the page says so.
 */
export function sourceFor(symbol: string): SourceLabel {
  if (!liveDataEnabled()) {
    return { source: "simulated", vendor: "TradeMyShow engine", asOf: null };
  }

  const quote = cachedQuote(symbol);
  if (!quote) return { source: "simulated", vendor: "TradeMyShow engine", asOf: null };

  const stats = cachedQuoteStats(symbol);
  const ageHours = quoteAgeHours(symbol) ?? 0;
  // Beyond a trading day old, calling it a quote would be a lie however it was
  // obtained; it is yesterday's close and is labelled as one.
  const source: DataSource = ageHours <= 12 ? "delayed" : "eod";
  return {
    source,
    vendor: vendorLabel(),
    asOf: stats?.quoteTime ?? null,
  };
}

function vendorLabel(): string {
  switch (providerChoice()) {
    case "yahoo":
      return "Yahoo Finance";
    case "stooq":
      return "Stooq";
    case "finnhub":
      return "Finnhub";
    case "mock":
      return "TradeMyShow engine";
    default:
      return "Yahoo Finance / Stooq";
  }
}

/** Human wording for a source label, used verbatim in the UI. */
export function sourceText(label: SourceLabel): string {
  switch (label.source) {
    case "live":
      return `Real-time · ${label.vendor}`;
    case "delayed":
      return `Delayed quote · ${label.vendor}`;
    case "eod":
      return `End-of-day close · ${label.vendor}`;
    case "simulated":
      return "Simulated data · not a real quote";
  }
}

/** Closes already cached for a symbol, used to decide whether to refetch. */
export function hasHistory(symbol: string, closes: PricePoint[]): boolean {
  return closes.length > 20;
}
