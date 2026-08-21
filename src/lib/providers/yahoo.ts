import type { NewsItem, PricePoint, Quote, QuoteStats, StockInfo } from "../types";
import { ProviderError } from "./types";
import type { MarketDataProvider, NewsProvider, SearchProvider } from "./types";

/**
 * Yahoo Finance adapter — the default real feed.
 *
 * Chosen because it needs no API key and no account, which is the difference
 * between the owner seeing real prices today and waiting on a vendor contract.
 * The three endpoints below are the public ones the Yahoo Finance website
 * itself calls; they are not a commercial data licence, so:
 *
 *   - prices are treated as delayed, and the UI says so;
 *   - nothing here is redistributed as a feed, only shown to the visitor;
 *   - the whole path degrades to the simulation if Yahoo changes or blocks it.
 *
 * When a paid licence is bought, this file is the only thing that has to be
 * swapped: everything downstream reads the cache, not the vendor.
 */

const BASE = "https://query1.finance.yahoo.com";

/**
 * Yahoo answers a bare programmatic agent with 401 or 429. A browser agent
 * string is what the endpoint expects; it is not an attempt to hide who is
 * calling, and the rate we call at stays well inside what a person browsing
 * the site would generate.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Safari/537.36";

const TIMEOUT_MS = 12_000;

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams(params);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
  } catch (err) {
    // A timeout or a DNS failure is transport, not data: worth one retry
    // later, never worth surfacing as "this symbol does not exist".
    throw new ProviderError(`Yahoo request failed: ${(err as Error).message}`, undefined, true);
  }

  if (res.status === 429) throw new ProviderError("Yahoo rate limit reached", 429, true);
  if (res.status === 404) throw new ProviderError("Yahoo has no such symbol", 404, false);
  if (!res.ok) throw new ProviderError(`Yahoo responded ${res.status}`, res.status, res.status >= 500);
  return (await res.json()) as T;
}

// ---------- chart ----------

interface ChartMeta {
  symbol?: string;
  currency?: string;
  exchangeName?: string;
  fullExchangeName?: string;
  instrumentType?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketTime?: number;
}

interface ChartResult {
  meta: ChartMeta;
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[]; open?: (number | null)[] }[] };
}

interface ChartResponse {
  chart: { result?: ChartResult[] | null; error?: { description?: string } | null };
}

async function chart(symbol: string, range: string, interval: string): Promise<ChartResult | null> {
  const body = await get<ChartResponse>(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
    range,
    interval,
    includePrePost: "false",
  });
  const result = body.chart?.result?.[0];
  return result ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Guard against the zeros and nulls a vendor emits for an untraded symbol. */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function quoteFromMeta(symbol: string, meta: ChartMeta): Quote | null {
  const price = num(meta.regularMarketPrice);
  const prev = num(meta.previousClose) ?? num(meta.chartPreviousClose);
  if (price === null || prev === null || prev === 0) return null;
  return {
    symbol: symbol.toUpperCase(),
    price: round2(price),
    prevClose: round2(prev),
    changePct: round2(((price - prev) / prev) * 100),
  };
}

function statsFromMeta(symbol: string, meta: ChartMeta, open: number | null): QuoteStats {
  const t = num(meta.regularMarketTime);
  return {
    symbol: symbol.toUpperCase(),
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    open,
    dayHigh: num(meta.regularMarketDayHigh),
    dayLow: num(meta.regularMarketDayLow),
    volume: num(meta.regularMarketVolume),
    fiftyTwoWeekHigh: num(meta.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: num(meta.fiftyTwoWeekLow),
    // Yahoo's chart endpoint does not carry a share count, so market cap is
    // left null here and estimated downstream, where it can be labelled.
    marketCap: null,
    quoteTime: t === null ? null : new Date(t * 1000).toISOString(),
  };
}

function closesFrom(result: ChartResult): PricePoint[] {
  const ts = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const out: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    // Yahoo emits nulls for halted sessions. A null is a gap, not a price:
    // dropping the point leaves the line continuous, whereas a zero would
    // draw a crash that never happened.
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    out.push({ t: new Date(ts[i] * 1000).toISOString().slice(0, 10), price: round2(c) });
  }
  return out;
}

export const yahooMarketData: MarketDataProvider = {
  name: "yahoo",

  async fetchQuote(symbol: string): Promise<Quote | null> {
    const result = await chart(symbol, "1d", "1d");
    return result ? quoteFromMeta(symbol, result.meta) : null;
  },

  async fetchQuoteWithStats(
    symbol: string,
  ): Promise<{ quote: Quote; stats: QuoteStats } | null> {
    const result = await chart(symbol, "1d", "1d");
    if (!result) return null;
    const quote = quoteFromMeta(symbol, result.meta);
    if (!quote) return null;
    const open = num(result.indicators?.quote?.[0]?.open?.[0]);
    return { quote, stats: statsFromMeta(symbol, result.meta, open) };
  },

  async fetchDailyCloses(symbol: string, days: number): Promise<PricePoint[]> {
    // Ask for the smallest range that covers the request. Yahoo only accepts a
    // fixed vocabulary of ranges, and asking for "max" every time would pull
    // decades of history to draw a one-month line.
    const range =
      days <= 5 ? "5d" : days <= 31 ? "1mo" : days <= 93 ? "3mo" : days <= 186 ? "6mo"
      : days <= 372 ? "1y" : days <= 745 ? "2y" : days <= 1860 ? "5y" : "10y";
    const result = await chart(symbol, range, "1d");
    return result ? closesFrom(result) : [];
  },

  /** Intraday bars for the current session, for the 1D chart. */
  async fetchIntraday(symbol: string): Promise<PricePoint[]> {
    const result = await chart(symbol, "1d", "5m");
    if (!result) return [];
    const ts = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const out: PricePoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c !== "number" || !Number.isFinite(c)) continue;
      out.push({ t: new Date(ts[i] * 1000).toISOString(), price: round2(c) });
    }
    return out;
  },
};

// ---------- search ----------

interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchDisp?: string;
  sector?: string;
  industry?: string;
  isYahooFinance?: boolean;
}

/** Yahoo's quoteType vocabulary mapped onto ours. */
function assetClassOf(quoteType?: string): StockInfo["assetClass"] {
  switch ((quoteType ?? "").toUpperCase()) {
    case "ETF":
    case "MUTUALFUND":
      return "etf";
    case "CRYPTOCURRENCY":
      return "crypto";
    case "INDEX":
      return "index";
    default:
      return "stock";
  }
}

export const yahooSearch: SearchProvider = {
  name: "yahoo",

  async search(query: string, limit = 10): Promise<StockInfo[]> {
    const q = query.trim();
    if (!q) return [];
    const body = await get<{ quotes?: YahooSearchQuote[] }>("/v1/finance/search", {
      q,
      quotesCount: String(Math.min(20, limit * 2)),
      newsCount: "0",
      listsCount: "0",
      enableFuzzyQuery: "false",
    });

    const seen = new Set<string>();
    const out: StockInfo[] = [];
    for (const r of body.quotes ?? []) {
      const symbol = r.symbol?.trim();
      if (!symbol || seen.has(symbol)) continue;
      // Options, futures and anything Yahoo cannot itself quote would give a
      // dead stock page, so they never reach the dropdown.
      const type = (r.quoteType ?? "").toUpperCase();
      if (!["EQUITY", "ETF", "MUTUALFUND", "INDEX", "CRYPTOCURRENCY"].includes(type)) continue;
      seen.add(symbol);
      out.push({
        symbol,
        name: r.longname ?? r.shortname ?? symbol,
        sector: r.sector ?? r.industry ?? r.exchDisp ?? "—",
        assetClass: assetClassOf(r.quoteType),
      });
      if (out.length >= limit) break;
    }
    return out;
  },
};

// ---------- news ----------

interface YahooNewsItem {
  uuid?: string;
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
  type?: string;
}

/** Positive/negative word lists — our own classifier, so we can defend it. */
const POSITIVE_WORDS = [
  "beat", "beats", "surge", "surges", "jump", "jumps", "rally", "rallies", "record",
  "upgrade", "upgraded", "raises", "raised", "growth", "profit", "wins", "approval", "tops",
];
const NEGATIVE_WORDS = [
  "miss", "misses", "plunge", "plunges", "fall", "falls", "slump", "cut", "cuts",
  "downgrade", "downgraded", "lawsuit", "probe", "recall", "loss", "losses", "warns", "layoffs",
];

export function classifyHeadline(text: string): NewsItem["sentiment"] {
  const words = text.toLowerCase().split(/[^a-z]+/);
  let score = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) score++;
    else if (NEGATIVE_WORDS.includes(w)) score--;
  }
  return score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
}

export const yahooNews: NewsProvider = {
  name: "yahoo",

  async fetchNews(symbol: string, from: Date, to: Date): Promise<NewsItem[]> {
    const body = await get<{ news?: YahooNewsItem[] }>("/v1/finance/search", {
      q: symbol,
      quotesCount: "0",
      newsCount: "10",
      listsCount: "0",
    });

    const out: NewsItem[] = [];
    for (const n of body.news ?? []) {
      if (!n.title || !n.uuid) continue;
      const published = n.providerPublishTime ? new Date(n.providerPublishTime * 1000) : null;
      if (!published || published < from || published > to) continue;
      out.push({
        id: `yahoo-${n.uuid}`,
        symbol: symbol.toUpperCase(),
        headline: n.title,
        // The search feed carries no body text. An empty summary is honest;
        // a fabricated one would be the exact thing this product exists to
        // avoid.
        summary: "",
        source: n.publisher ?? "Yahoo Finance",
        url: n.link,
        publishedAt: published.toISOString(),
        sentiment: classifyHeadline(n.title),
        impact: 0.5,
      });
    }
    return out.slice(0, 8);
  },
};
