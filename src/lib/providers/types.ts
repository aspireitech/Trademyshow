import type { NewsItem, PricePoint, Quote, QuoteStats, StockInfo } from "../types";

/**
 * The contract a real market-data vendor has to satisfy.
 *
 * Async, because every real provider is an HTTP call. The rest of the app
 * reads prices synchronously — scoring, attribution and digest generation are
 * all pure functions over a snapshot — so a provider never feeds those
 * functions directly. It fills a cache, and the cache is what they read.
 * That separation is why adding live data does not turn the whole codebase
 * async.
 */
export interface MarketDataProvider {
  readonly name: string;
  fetchQuote(symbol: string): Promise<Quote | null>;
  /** Daily closes, oldest first, up to `days` back. */
  fetchDailyCloses(symbol: string, days: number): Promise<PricePoint[]>;
  /**
   * The quote plus whatever else the vendor volunteers in the same response
   * (day range, 52-week range, volume). Optional: an end-of-day CSV feed has
   * none of it, and one round trip that returns everything beats two.
   */
  fetchQuoteWithStats?(symbol: string): Promise<{ quote: Quote; stats: QuoteStats } | null>;
  /** Intraday bars for the current session, for the 1D chart. */
  fetchIntraday?(symbol: string): Promise<PricePoint[]>;
}

export interface NewsProvider {
  readonly name: string;
  fetchNews(symbol: string, from: Date, to: Date): Promise<NewsItem[]>;
}

/**
 * Ticker lookup across the whole market rather than the local universe.
 *
 * Separate from MarketDataProvider because they are separate concerns: a
 * vendor may be excellent at quotes and useless at search, and the type-ahead
 * has to keep working when the quote feed is rate-limited.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<StockInfo[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
