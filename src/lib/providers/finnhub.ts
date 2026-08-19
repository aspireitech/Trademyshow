import type { MarketDataProvider, NewsProvider } from "./types";
import { ProviderError } from "./types";
import type { NewsItem, PricePoint, Quote } from "../types";
import { round2 } from "../marketdata";

/**
 * Finnhub adapter.
 *
 * Chosen as the first real provider because one key covers quotes, daily
 * candles and company news, which is the whole surface this product needs —
 * and because its free tier permits end-of-day data, so the licensing question
 * stays in the cheap tier rather than the per-user exchange-fee tier.
 *
 * Every method returns null or an empty array rather than throwing on missing
 * data. A symbol the vendor does not cover is a normal condition, not an
 * error; only transport and auth failures throw.
 */

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new ProviderError("FINNHUB_API_KEY is not set", undefined, false);
  return key;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const query = new URLSearchParams({ ...params, token: apiKey() });
  const res = await fetch(`${BASE}${path}?${query}`, {
    signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/json" },
  });

  if (res.status === 429) {
    throw new ProviderError("Finnhub rate limit reached", 429, true);
  }
  if (res.status === 401 || res.status === 403) {
    // Not retryable: retrying a bad key just burns quota and hides the cause.
    throw new ProviderError(`Finnhub rejected the API key (${res.status})`, res.status, false);
  }
  if (!res.ok) {
    throw new ProviderError(`Finnhub responded ${res.status}`, res.status, true);
  }
  return (await res.json()) as T;
}

interface FinnhubQuote {
  c: number; // current
  pc: number; // previous close
  t: number; // unix seconds
}

export const finnhubMarketData: MarketDataProvider = {
  name: "finnhub",

  async fetchQuote(symbol: string): Promise<Quote | null> {
    const q = await get<FinnhubQuote>("/quote", { symbol });
    // Finnhub answers an unknown symbol with zeroes rather than a 404.
    if (!q || !q.c || !q.pc) return null;
    return {
      symbol,
      price: round2(q.c),
      prevClose: round2(q.pc),
      changePct: round2(((q.c - q.pc) / q.pc) * 100),
    };
  },

  async fetchDailyCloses(symbol: string, days: number): Promise<PricePoint[]> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86_400;
    const c = await get<{ s: string; c?: number[]; t?: number[] }>("/stock/candle", {
      symbol,
      resolution: "D",
      from: String(from),
      to: String(to),
    });
    if (c.s !== "ok" || !c.c || !c.t) return [];
    return c.c.map((close, i) => ({
      t: new Date(c.t![i] * 1000).toISOString().slice(0, 10),
      price: round2(close),
    }));
  },
};

interface FinnhubNews {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
}

export const finnhubNews: NewsProvider = {
  name: "finnhub",

  async fetchNews(symbol: string, from: Date, to: Date): Promise<NewsItem[]> {
    const items = await get<FinnhubNews[]>("/company-news", {
      symbol,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    if (!Array.isArray(items)) return [];

    return items.slice(0, 6).map((n) => ({
      id: `finnhub-${n.id}`,
      symbol,
      headline: n.headline,
      summary: n.summary?.slice(0, 240) ?? "",
      source: n.source,
      url: n.url,
      publishedAt: new Date(n.datetime * 1000).toISOString(),
      // Sentiment is scored by our own classifier, not taken from the vendor:
      // the score has to be something we can explain and defend.
      sentiment: classify(`${n.headline} ${n.summary ?? ""}`),
      impact: 0.5,
    }));
  },
};

const POSITIVE = /\b(beat|beats|surge|surged|jump|jumps|rally|record|upgrade|raises?|strong|growth|profit|wins?|approval)\b/i;
const NEGATIVE = /\b(miss|missed|plunge|plunged|fall|falls|drop|drops|downgrade|cuts?|weak|loss|losses|probe|lawsuit|recall|delay)\b/i;

/**
 * A transparent keyword classifier rather than a vendor sentiment field.
 * News is 30% of the Insight Score, and a number we cannot explain has no
 * place in a product whose entire claim is that the working is visible.
 */
function classify(text: string): NewsItem["sentiment"] {
  const pos = POSITIVE.test(text);
  const neg = NEGATIVE.test(text);
  if (pos && !neg) return "positive";
  if (neg && !pos) return "negative";
  return "neutral";
}
