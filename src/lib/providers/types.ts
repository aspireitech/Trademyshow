import type { NewsItem, PricePoint, Quote } from "../types";

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
}

export interface NewsProvider {
  readonly name: string;
  fetchNews(symbol: string, from: Date, to: Date): Promise<NewsItem[]>;
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
