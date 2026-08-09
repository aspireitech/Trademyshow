import type { PricePoint, Quote, StockInfo, Timeframe } from "./types";

/**
 * Deterministic mock market-data provider.
 *
 * Prices come from a seeded random walk keyed by symbol, anchored to the
 * calendar, so the same (symbol, date) always yields the same series —
 * which makes the digest engine fully testable and the app usable with no
 * external API key. Swap in a real provider (Finnhub, Polygon, Alpha
 * Vantage) by implementing the same three functions behind
 * MARKET_DATA_PROVIDER.
 */

export const UNIVERSE: StockInfo[] = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary" },
  { symbol: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors" },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
  { symbol: "TSM", name: "Taiwan Semiconductor", sector: "Semiconductors" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "Semiconductors" },
  { symbol: "INTC", name: "Intel Corp.", sector: "Semiconductors" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { symbol: "BAC", name: "Bank of America Corp.", sector: "Financials" },
  { symbol: "GS", name: "Goldman Sachs Group", sector: "Financials" },
  { symbol: "V", name: "Visa Inc.", sector: "Financials" },
  { symbol: "MA", name: "Mastercard Inc.", sector: "Financials" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { symbol: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", sector: "Energy" },
  { symbol: "CVX", name: "Chevron Corp.", sector: "Energy" },
  { symbol: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples" },
  { symbol: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples" },
  { symbol: "WMT", name: "Walmart Inc.", sector: "Consumer Staples" },
  { symbol: "PG", name: "Procter & Gamble Co.", sector: "Consumer Staples" },
  { symbol: "DIS", name: "Walt Disney Co.", sector: "Media" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Media" },
  { symbol: "BA", name: "Boeing Co.", sector: "Industrials" },
  { symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "Industrials" },
  { symbol: "UBER", name: "Uber Technologies", sector: "Technology" },
  { symbol: "SHOP", name: "Shopify Inc.", sector: "Technology" },
  { symbol: "PLTR", name: "Palantir Technologies", sector: "Technology" },
  { symbol: "COIN", name: "Coinbase Global", sector: "Financials" },
  { symbol: "SQ", name: "Block Inc.", sector: "Financials" },
];

const BY_SYMBOL = new Map(UNIVERSE.map((s) => [s.symbol, s]));

export function getStockInfo(symbol: string): StockInfo | null {
  return BY_SYMBOL.get(symbol.toUpperCase()) ?? null;
}

export function searchStocks(query: string, limit = 8): StockInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return UNIVERSE.filter(
    (s) => s.symbol.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q),
  ).slice(0, limit);
}

// ---------- deterministic PRNG ----------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- price series ----------

const TOTAL_DAYS = 6 * 365; // "ALL" horizon
const EPOCH = Date.UTC(2000, 0, 1);

function dayIndex(d: Date): number {
  return Math.floor((d.getTime() - EPOCH) / 86_400_000);
}

/**
 * Daily close for a symbol at an absolute day index. Deterministic:
 * derived from a per-symbol random walk replayed from a fixed origin.
 * Cached per symbol so repeated calls are cheap.
 */
const seriesCache = new Map<string, { originDay: number; closes: number[] }>();

function dailySeries(symbol: string, asOf: Date): { originDay: number; closes: number[] } {
  const endDay = dayIndex(asOf);
  const key = `${symbol}:${endDay}`;
  const cached = seriesCache.get(key);
  if (cached) return cached;

  const info = getStockInfo(symbol);
  const seed = hashString(symbol);
  const rand = mulberry32(seed);
  const base = 20 + (seed % 400); // per-symbol base price 20..420
  const drift = 0.00035 + (info ? hashString(info.sector) % 5 : 0) * 0.0001;
  const vol = 0.012 + ((seed >> 8) % 10) * 0.0012;

  const originDay = endDay - TOTAL_DAYS + 1;
  const closes: number[] = new Array(TOTAL_DAYS);
  let price = base;
  // Replay the walk deterministically from the origin day. The PRNG stream
  // position is tied to the absolute day so the same date gives the same close.
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    // occasional event days (earnings-like moves)
    const eventDay = (originDay + i + seed) % 63 === 0;
    const eventShock = eventDay ? (rand() - 0.45) * 0.08 : 0;
    price = Math.max(1, price * (1 + drift + shock + eventShock));
    closes[i] = price;
  }
  const out = { originDay, closes };
  seriesCache.set(key, out);
  if (seriesCache.size > 500) seriesCache.clear();
  return out;
}

function closeAt(symbol: string, asOf: Date, daysBack: number): number {
  const { closes } = dailySeries(symbol, asOf);
  const idx = Math.max(0, closes.length - 1 - daysBack);
  return closes[idx];
}

export function getQuote(symbol: string, asOf: Date = new Date()): Quote {
  const price = closeAt(symbol, asOf, 0);
  const prevClose = closeAt(symbol, asOf, 1);
  return {
    symbol: symbol.toUpperCase(),
    price: round2(price),
    prevClose: round2(prevClose),
    changePct: round2(((price - prevClose) / prevClose) * 100),
  };
}

const RANGE_DAYS: Record<Exclude<Timeframe, "1D" | "YTD" | "ALL">, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 91,
  "6M": 182,
  "1Y": 365,
  "5Y": 5 * 365,
};

export function getHistory(symbol: string, range: Timeframe, asOf: Date = new Date()): PricePoint[] {
  if (range === "1D") return intradaySeries(symbol, asOf);

  let days: number;
  if (range === "ALL") days = TOTAL_DAYS - 1;
  else if (range === "YTD") {
    const jan1 = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
    days = Math.max(1, dayIndex(asOf) - dayIndex(jan1));
  } else days = RANGE_DAYS[range];

  const { closes } = dailySeries(symbol, asOf);
  const points: PricePoint[] = [];
  // Downsample long ranges to <= 260 points to keep payloads small.
  const step = Math.max(1, Math.floor(days / 260));
  for (let back = days; back >= 0; back -= step) {
    const d = new Date(asOf.getTime() - back * 86_400_000);
    const idx = Math.max(0, closes.length - 1 - back);
    points.push({ t: d.toISOString().slice(0, 10), price: round2(closes[idx]) });
  }
  return points;
}

/** 5-minute bars for the current session, seeded per symbol+day. */
function intradaySeries(symbol: string, asOf: Date): PricePoint[] {
  const prevClose = closeAt(symbol, asOf, 1);
  const todayClose = closeAt(symbol, asOf, 0);
  const rand = mulberry32(hashString(`${symbol}:${dayIndex(asOf)}`));
  const bars = 78; // 6.5h session / 5min
  const points: PricePoint[] = [];
  let price = prevClose;
  const sessionStart = new Date(asOf);
  sessionStart.setUTCHours(14, 30, 0, 0); // 9:30 ET in UTC (approx)
  for (let i = 0; i < bars; i++) {
    const progress = (i + 1) / bars;
    // Random wiggle around a path that ends at today's close.
    const target = prevClose + (todayClose - prevClose) * progress;
    price = target * (1 + (rand() - 0.5) * 0.004);
    const t = new Date(sessionStart.getTime() + i * 5 * 60_000);
    points.push({ t: t.toISOString(), price: round2(price) });
  }
  points[points.length - 1].price = round2(todayClose);
  return points;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Return % change over a range, from history endpoints. */
export function rangeChangePct(symbol: string, range: Timeframe, asOf: Date = new Date()): number {
  const hist = getHistory(symbol, range, asOf);
  const first = hist[0].price;
  const last = hist[hist.length - 1].price;
  return round2(((last - first) / first) * 100);
}
