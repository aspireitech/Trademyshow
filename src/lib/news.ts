import { getStockInfo, usingLiveData } from "./marketdata";
import { cachedNews } from "./providers/cache";
import type { NewsItem } from "./types";

/**
 * Deterministic mock news provider. Headlines are selected from a template
 * pool keyed by (symbol, date) and aligned with the sign of the day's move,
 * so the digest's "why" matches the "what". Replace with a real feed
 * (NewsAPI, Finnhub news, Benzinga) behind the same getNews() signature.
 */

const POSITIVE_TEMPLATES = [
  ["{name} tops quarterly earnings estimates, raises full-year guidance", "Revenue and EPS both beat consensus; management cited stronger demand.", 0.9],
  ["Analysts upgrade {name} to Buy on improving margins", "Two major banks lifted price targets after channel checks.", 0.6],
  ["{name} announces expanded buyback and dividend increase", "The board authorized additional share repurchases.", 0.5],
  ["{name} unveils new product line, early orders exceed expectations", "Pre-orders in the first 48 hours surpassed internal forecasts.", 0.7],
  ["{sector} stocks rally as sector outlook brightens", "Sector-wide strength lifted peers in sympathy.", 0.4],
] as const;

const NEGATIVE_TEMPLATES = [
  ["{name} cuts guidance, citing softening demand", "Management lowered the full-year outlook on macro headwinds.", 0.9],
  ["Analysts flag margin pressure at {name}", "A downgrade cited rising input costs and competitive pricing.", 0.6],
  ["{name} faces regulatory scrutiny over recent practices", "A probe was opened; the company says it is cooperating.", 0.7],
  ["Key executive departs {name}", "The company announced a leadership transition.", 0.4],
  ["{sector} sector slides on macro concerns", "Rate worries weighed on the broader sector.", 0.4],
] as const;

const NEUTRAL_TEMPLATES = [
  ["{name} to report earnings next week", "Consensus expects modest year-over-year growth.", 0.3],
  ["{name} presents at industry conference", "Management reiterated its medium-term targets.", 0.2],
] as const;

const SOURCES = ["MarketWire", "FinDaily", "The Street Ledger", "Global Markets Desk"];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * News for a symbol on a given day. `dayChangePct` steers sentiment so the
 * mock feed plausibly explains the price move.
 */
export function getNews(symbol: string, dayChangePct: number, asOf: Date = new Date()): NewsItem[] {
  const info = getStockInfo(symbol);
  if (!info) return [];

  // Real headlines win when a feed is configured and has something recent.
  // Falling back to the mock rather than showing nothing keeps the news
  // component of the score defined on days the vendor returns an empty set.
  if (usingLiveData()) {
    const since = new Date(asOf.getTime() - 3 * 86_400_000);
    const live = cachedNews(symbol, since);
    if (live.length > 0) return live;
  }
  const dayKey = asOf.toISOString().slice(0, 10);
  const seed = hashString(`${symbol}:${dayKey}`);

  const pool =
    dayChangePct > 0.8 ? POSITIVE_TEMPLATES : dayChangePct < -0.8 ? NEGATIVE_TEMPLATES : NEUTRAL_TEMPLATES;
  const sentiment = dayChangePct > 0.8 ? "positive" : dayChangePct < -0.8 ? "negative" : "neutral";

  const count = Math.abs(dayChangePct) > 2 ? 2 : 1;
  const items: NewsItem[] = [];
  for (let i = 0; i < count && i < pool.length; i++) {
    const [headlineTpl, summary, impact] = pool[(seed + i) % pool.length];
    const publishedAt = new Date(asOf);
    publishedAt.setUTCHours(13 - i * 2, (seed + i * 17) % 60, 0, 0);
    items.push({
      id: `${symbol}-${dayKey}-${i}`,
      symbol: info.symbol,
      headline: headlineTpl.replace("{name}", info.name).replace("{sector}", info.sector),
      summary,
      source: SOURCES[(seed + i) % SOURCES.length],
      publishedAt: publishedAt.toISOString(),
      sentiment,
      impact: impact as number,
    });
  }
  return items;
}
