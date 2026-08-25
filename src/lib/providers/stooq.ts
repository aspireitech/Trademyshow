import type { PricePoint, Quote } from "../types";
import type { MarketDataProvider } from "./types";
import { ProviderError } from "./types";

/**
 * Stooq adapter — the backstop under Yahoo.
 *
 * End-of-day only, CSV, no key, no account, and a completely different
 * operator. That last point is the reason it exists: a fallback that shares a
 * vendor with the primary is not a fallback. If Yahoo blocks or changes its
 * private endpoints, the site keeps showing real closes instead of dropping
 * back to a simulation.
 *
 * Yesterday's close is not a live price, so everything sourced here is
 * labelled "end of day" in the UI rather than passed off as a quote.
 */

const BASE = "https://stooq.com";
const TIMEOUT_MS = 12_000;

/**
 * Stooq's symbol vocabulary: US listings carry a `.us` suffix, its tickers are
 * lower case, and a class share is hyphenated where the US market uses a dot
 * (BRK.B → brk-b.us). Crypto is quoted as a pair with no suffix.
 */
export function stooqSymbol(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  if (s.endsWith("-usd")) return s.replace("-usd", "usd");
  if (s.startsWith("^")) return s;
  return `${s.replace(".", "-")}.us`;
}

async function csv(path: string, params: Record<string, string>): Promise<string[]> {
  const query = new URLSearchParams(params);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new ProviderError(`Stooq request failed: ${(err as Error).message}`, undefined, true);
  }
  if (!res.ok) throw new ProviderError(`Stooq responded ${res.status}`, res.status, res.status >= 500);
  const text = await res.text();
  // Stooq answers an unknown symbol with a one-line body rather than a 404.
  if (/^No data|^Exceeded/i.test(text.trim())) {
    throw new ProviderError(text.trim().slice(0, 80), undefined, /^Exceeded/i.test(text.trim()));
  }
  return text.trim().split(/\r?\n/);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNum(v: string | undefined): number | null {
  if (!v || v === "N/D") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const stooqMarketData: MarketDataProvider = {
  name: "stooq",

  async fetchQuote(symbol: string): Promise<Quote | null> {
    // The daily file gives the previous close as well as the last one, which
    // the single-quote endpoint does not — and a change percentage computed
    // against the wrong day is worse than no change percentage.
    const closes = await this.fetchDailyCloses(symbol, 7);
    if (closes.length < 2) return null;
    const price = closes[closes.length - 1].price;
    const prev = closes[closes.length - 2].price;
    if (!prev) return null;
    return {
      symbol: symbol.toUpperCase(),
      price: round2(price),
      prevClose: round2(prev),
      changePct: round2(((price - prev) / prev) * 100),
    };
  },

  async fetchDailyCloses(symbol: string, days: number): Promise<PricePoint[]> {
    const from = new Date(Date.now() - days * 86_400_000);
    const lines = await csv("/q/d/l/", {
      s: stooqSymbol(symbol),
      i: "d",
      d1: from.toISOString().slice(0, 10).replace(/-/g, ""),
      d2: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
    });

    // Header: Date,Open,High,Low,Close,Volume
    const out: PricePoint[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const close = parseNum(cols[4]);
      if (!cols[0] || close === null) continue;
      out.push({ t: cols[0], price: round2(close) });
    }
    return out;
  },
};
