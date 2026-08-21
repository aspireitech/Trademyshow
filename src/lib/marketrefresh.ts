import { cachedCloses, cacheIntraday, cachedSymbols } from "./providers/cache";
import { liveDataEnabled, marketDataChain, refreshMany, refreshNews } from "./providers/feed";
import { UNIVERSE } from "./marketdata";

/**
 * The job that turns a vendor into the numbers on the page.
 *
 * Everything the site renders is read synchronously from the cache; this is
 * the only place that talks to a vendor on a schedule. Splitting it in two —
 * a frequent quote pass and a daily history pass — is what keeps the request
 * count sane: 150 quotes every few minutes is ordinary traffic, 150 five-year
 * histories every few minutes would get the server blocked by lunchtime.
 */

export interface RefreshSummary {
  attempted: number;
  refreshed: number;
  failed: number;
  /** Vendor name → how many symbols it answered for. */
  vendors: Record<string, number>;
  /** Up to five failures, for the operator to read. */
  errors: string[];
  startedAt: string;
  durationMs: number;
  live: boolean;
}

/** The instruments a visitor sees before doing anything: every screen's rows. */
export function coreSymbols(): string[] {
  return UNIVERSE.map((s) => s.symbol);
}

function summarise(
  results: { symbol: string; ok: boolean; vendor: string | null; error: string | null }[],
  startedAt: Date,
  live: boolean,
): RefreshSummary {
  const vendors: Record<string, number> = {};
  const errors: string[] = [];
  let refreshed = 0;

  for (const r of results) {
    if (r.ok && r.vendor) {
      refreshed++;
      vendors[r.vendor] = (vendors[r.vendor] ?? 0) + 1;
    } else if (errors.length < 5) {
      errors.push(`${r.symbol}: ${r.error ?? "unknown"}`);
    }
  }

  return {
    attempted: results.length,
    refreshed,
    failed: results.length - refreshed,
    vendors,
    errors,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    live,
  };
}

/**
 * Refresh prices for the whole tracked universe.
 *
 * `withHistory` is set on the first run of a fresh installation and once a
 * day thereafter: without daily closes there are no sparklines, no 52-week
 * screens and no trend columns, so an empty cache has to pull them once
 * before the site looks like anything.
 */
export async function refreshMarket(
  { withHistory = false, symbols = coreSymbols() }: {
    withHistory?: boolean;
    symbols?: string[];
  } = {},
): Promise<RefreshSummary> {
  const startedAt = new Date();
  if (!liveDataEnabled()) {
    return {
      attempted: 0, refreshed: 0, failed: 0, vendors: {}, errors: [],
      startedAt: startedAt.toISOString(), durationMs: 0, live: false,
    };
  }
  const results = await refreshMany(symbols, { withHistory });
  return summarise(results, startedAt, true);
}

/**
 * True when the cache has never been filled with daily closes.
 *
 * Used to decide whether a refresh should pull history: checking one liquid
 * symbol is enough, because history is always fetched for the whole universe
 * at once.
 */
export function historyMissing(): boolean {
  if (!liveDataEnabled()) return false;
  try {
    const since = new Date(Date.now() - 120 * 86_400_000);
    return cachedCloses("AAPL", since).length < 20;
  } catch {
    return false;
  }
}

/** How much of the universe currently has a real, fresh quote behind it. */
export function coverage(): { covered: number; total: number; pct: number } {
  const total = UNIVERSE.length;
  if (!liveDataEnabled()) return { covered: 0, total, pct: 0 };
  try {
    const fresh = new Set(cachedSymbols());
    const covered = UNIVERSE.filter((s) => fresh.has(s.symbol.toUpperCase())).length;
    return { covered, total, pct: Math.round((covered / total) * 100) };
  } catch {
    return { covered: 0, total, pct: 0 };
  }
}

/**
 * Everything one symbol's page needs: quote, history, today's bars, headlines.
 *
 * Called when someone opens a stock we have not seen recently, so a symbol
 * outside the tracked universe still renders a real page on first view.
 */
export async function refreshSymbolDeeply(
  symbol: string,
  { budgetMs = 8_000 }: { budgetMs?: number } = {},
): Promise<boolean> {
  if (!liveDataEnabled()) return false;
  const started = Date.now();

  // Bounded, because this runs inside a page request. A visitor waiting on a
  // vendor that is not answering should get the simulated page quickly and
  // clearly labelled, not a spinner for half a minute.
  const [priced] = await refreshMany([symbol], {
    withHistory: true, concurrency: 1, budgetMs,
  });

  // The price is what the page cannot do without; intraday bars and headlines
  // are extras. If the budget is already spent getting the price, they are
  // skipped rather than allowed to extend the wait — the scheduled refresh
  // will pick them up.
  const deadline = started + budgetMs;

  for (const provider of marketDataChain()) {
    if (!provider.fetchIntraday || Date.now() > deadline) break;
    try {
      const bars = await provider.fetchIntraday(symbol);
      if (bars.length > 1) {
        cacheIntraday(symbol, bars);
        break;
      }
    } catch {
      // try the next vendor
    }
  }

  if (Date.now() <= deadline) await refreshNews(symbol).catch(() => false);

  return priced?.ok ?? false;
}
