import { getDb } from "../db";
import type { NewsItem, PricePoint, Quote, QuoteStats, StockInfo } from "../types";

/**
 * A synchronous read layer over asynchronously fetched vendor data.
 *
 * This is the piece that lets live market data arrive without making the whole
 * application async. A refresh job calls the provider and writes here; scoring,
 * attribution and digest generation read here, synchronously, exactly as they
 * read the mock today.
 *
 * It doubles as the outage plan: if the vendor is down at 6am, the cache still
 * holds yesterday's closes, and a digest built from slightly stale data beats
 * no digest at all — provided the staleness is visible, which `quoteAge` makes
 * it.
 */

export function cacheQuote(q: Quote, fetchedAt: Date = new Date()): void {
  getDb()
    .prepare(
      "INSERT INTO quote_cache (symbol, price, prev_close, change_pct, fetched_at)\n" +
        "VALUES (?, ?, ?, ?, ?)\n" +
        "ON CONFLICT(symbol) DO UPDATE SET price = excluded.price, prev_close = excluded.prev_close,\n" +
        "  change_pct = excluded.change_pct, fetched_at = excluded.fetched_at",
    )
    .run(q.symbol.toUpperCase(), q.price, q.prevClose, q.changePct, fetchedAt.toISOString());
}

interface QuoteRow {
  symbol: string; price: number; prev_close: number;
  change_pct: number; fetched_at: string;
}

export function cachedQuote(symbol: string, maxAgeMs = 26 * 3600_000): Quote | null {
  const row = getDb()
    .prepare("SELECT * FROM quote_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as QuoteRow | undefined;
  if (!row) return null;
  // Beyond the window the data is not "slightly stale", it is wrong. Better to
  // fall through to the mock, which at least announces itself as generated.
  if (Date.now() - new Date(row.fetched_at).getTime() > maxAgeMs) return null;
  return {
    symbol: row.symbol,
    price: row.price,
    prevClose: row.prev_close,
    changePct: row.change_pct,
  };
}

/** How old the cached quote is, in hours, or null when uncached. */
export function quoteAgeHours(symbol: string): number | null {
  const row = getDb()
    .prepare("SELECT fetched_at FROM quote_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as { fetched_at: string } | undefined;
  return row ? (Date.now() - new Date(row.fetched_at).getTime()) / 3600_000 : null;
}

export function cacheCloses(symbol: string, points: PricePoint[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO close_cache (symbol, day, price) VALUES (?, ?, ?)\n" +
      "ON CONFLICT(symbol, day) DO UPDATE SET price = excluded.price",
  );
  // One transaction: a partially written history would produce a chart with a
  // hole in it, and holes read as real price movement.
  db.transaction(() => {
    for (const p of points) stmt.run(symbol.toUpperCase(), p.t, p.price);
  })();
}

export function cachedCloses(symbol: string, since: Date): PricePoint[] {
  const rows = getDb()
    .prepare("SELECT day, price FROM close_cache WHERE symbol = ? AND day >= ? ORDER BY day")
    .all(symbol.toUpperCase(), since.toISOString().slice(0, 10)) as { day: string; price: number }[];
  return rows.map((r) => ({ t: r.day, price: r.price }));
}

export function cacheNews(symbol: string, items: NewsItem[]): void {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO news_cache (id, symbol, headline, summary, source, url, published_at, sentiment, impact)\n" +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const n of items) {
      stmt.run(n.id, symbol.toUpperCase(), n.headline, n.summary, n.source,
        n.url ?? null, n.publishedAt, n.sentiment, n.impact);
    }
  })();
}

interface NewsRow {
  id: string; symbol: string; headline: string; summary: string;
  source: string; url: string | null; published_at: string;
  sentiment: NewsItem["sentiment"]; impact: number;
}

export function cachedNews(symbol: string, since: Date, limit = 4): NewsItem[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM news_cache WHERE symbol = ? AND published_at >= ? ORDER BY published_at DESC LIMIT ?",
    )
    .all(symbol.toUpperCase(), since.toISOString(), limit) as NewsRow[];
  return rows.map((r) => ({
    id: r.id, symbol: r.symbol, headline: r.headline, summary: r.summary,
    source: r.source, url: r.url ?? undefined, publishedAt: r.published_at,
    sentiment: r.sentiment, impact: r.impact,
  }));
}

export interface CacheStats {
  quotes: number;
  closes: number;
  news: number;
  freshestQuote: string | null;
}

export function cacheStats(): CacheStats {
  const db = getDb();
  const n = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const freshest = db
    .prepare("SELECT MAX(fetched_at) AS t FROM quote_cache")
    .get() as { t: string | null };
  return {
    quotes: n("SELECT COUNT(*) AS n FROM quote_cache"),
    closes: n("SELECT COUNT(*) AS n FROM close_cache"),
    news: n("SELECT COUNT(*) AS n FROM news_cache"),
    freshestQuote: freshest.t,
  };
}

// ---------- quote stats ----------

/**
 * The extras a real feed supplies beside the price: day range, 52-week range,
 * volume, and where it traded. Written whole rather than merged field by
 * field — the vendor's snapshot is internally consistent, and stitching two
 * snapshots together produces a day range the price sits outside of.
 */
export function cacheQuoteStats(s: QuoteStats, fetchedAt: Date = new Date()): void {
  getDb()
    .prepare(
      "INSERT INTO quote_stats_cache (symbol, currency, exchange, open, day_high, day_low,\n" +
        "  volume, week52_high, week52_low, market_cap, quote_time, fetched_at)\n" +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n" +
        "ON CONFLICT(symbol) DO UPDATE SET currency = excluded.currency, exchange = excluded.exchange,\n" +
        "  open = excluded.open, day_high = excluded.day_high, day_low = excluded.day_low,\n" +
        "  volume = excluded.volume, week52_high = excluded.week52_high,\n" +
        "  week52_low = excluded.week52_low, market_cap = excluded.market_cap,\n" +
        "  quote_time = excluded.quote_time, fetched_at = excluded.fetched_at",
    )
    .run(
      s.symbol.toUpperCase(), s.currency, s.exchange, s.open, s.dayHigh, s.dayLow,
      s.volume, s.fiftyTwoWeekHigh, s.fiftyTwoWeekLow, s.marketCap, s.quoteTime,
      fetchedAt.toISOString(),
    );
}

interface StatsRow {
  symbol: string; currency: string | null; exchange: string | null;
  open: number | null; day_high: number | null; day_low: number | null;
  volume: number | null; week52_high: number | null; week52_low: number | null;
  market_cap: number | null; quote_time: string | null; fetched_at: string;
}

export function cachedQuoteStats(symbol: string, maxAgeMs = 26 * 3600_000): QuoteStats | null {
  const row = getDb()
    .prepare("SELECT * FROM quote_stats_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as StatsRow | undefined;
  if (!row) return null;
  if (Date.now() - new Date(row.fetched_at).getTime() > maxAgeMs) return null;
  return {
    symbol: row.symbol,
    currency: row.currency,
    exchange: row.exchange,
    open: row.open,
    dayHigh: row.day_high,
    dayLow: row.day_low,
    volume: row.volume,
    fiftyTwoWeekHigh: row.week52_high,
    fiftyTwoWeekLow: row.week52_low,
    marketCap: row.market_cap,
    quoteTime: row.quote_time,
  };
}

/** Symbols that already carry a cached quote, freshest first. */
export function cachedSymbols(maxAgeMs = 26 * 3600_000): string[] {
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  return (
    getDb()
      .prepare("SELECT symbol FROM quote_cache WHERE fetched_at >= ? ORDER BY fetched_at DESC")
      .all(cutoff) as { symbol: string }[]
  ).map((r) => r.symbol);
}

// ---------- symbol directory ----------

/**
 * Instruments learned from the vendor's search rather than shipped in the
 * universe. Without this a visitor who looks up a small cap gets a dead page,
 * which is precisely the moment they decide the site does not cover their
 * holdings.
 */
export function rememberSymbol(info: StockInfo, source = "vendor"): void {
  getDb()
    .prepare(
      "INSERT INTO symbol_directory (symbol, name, sector, asset_class, source)\n" +
        "VALUES (?, ?, ?, ?, ?)\n" +
        "ON CONFLICT(symbol) DO UPDATE SET name = excluded.name, sector = excluded.sector,\n" +
        "  asset_class = excluded.asset_class",
    )
    .run(info.symbol.toUpperCase(), info.name, info.sector, info.assetClass ?? "stock", source);
}

interface DirectoryRow {
  symbol: string; name: string; sector: string; asset_class: string;
}

function toInfo(row: DirectoryRow): StockInfo {
  return {
    symbol: row.symbol,
    name: row.name,
    sector: row.sector,
    assetClass: row.asset_class as StockInfo["assetClass"],
  };
}

export function knownSymbol(symbol: string): StockInfo | null {
  const row = getDb()
    .prepare("SELECT * FROM symbol_directory WHERE symbol = ?")
    .get(symbol.toUpperCase()) as DirectoryRow | undefined;
  return row ? toInfo(row) : null;
}

/** Prefix match over remembered symbols, so repeat lookups skip the vendor. */
export function searchDirectory(query: string, limit = 8): StockInfo[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const rows = getDb()
    .prepare(
      "SELECT * FROM symbol_directory\n" +
        " WHERE symbol LIKE ? OR UPPER(name) LIKE ?\n" +
        " ORDER BY CASE WHEN symbol = ? THEN 0 WHEN symbol LIKE ? THEN 1 ELSE 2 END,\n" +
        "          LENGTH(symbol), symbol\n" +
        " LIMIT ?",
    )
    .all(`${q}%`, `%${q}%`, q, `${q}%`, limit) as DirectoryRow[];
  return rows.map(toInfo);
}

// ---------- intraday ----------

/** Today's bars for one symbol. Replaced whole on every refresh. */
export function cacheIntraday(symbol: string, points: PricePoint[], day?: string): void {
  const d = day ?? new Date().toISOString().slice(0, 10);
  getDb()
    .prepare(
      "INSERT INTO intraday_cache (symbol, day, points, fetched_at) VALUES (?, ?, ?, ?)\n" +
        "ON CONFLICT(symbol) DO UPDATE SET day = excluded.day, points = excluded.points,\n" +
        "  fetched_at = excluded.fetched_at",
    )
    .run(symbol.toUpperCase(), d, JSON.stringify(points), new Date().toISOString());
}

/**
 * Today's bars, or null. Bars from a previous session are deliberately not
 * returned: a chart labelled "today" showing Friday is worse than no chart.
 */
export function cachedIntraday(symbol: string, maxAgeMs = 30 * 60_000): PricePoint[] | null {
  const row = getDb()
    .prepare("SELECT day, points, fetched_at FROM intraday_cache WHERE symbol = ?")
    .get(symbol.toUpperCase()) as { day: string; points: string; fetched_at: string } | undefined;
  if (!row) return null;
  if (Date.now() - new Date(row.fetched_at).getTime() > maxAgeMs) return null;
  try {
    const points = JSON.parse(row.points) as PricePoint[];
    return points.length > 1 ? points : null;
  } catch {
    return null;
  }
}

/** Recent headlines across every symbol, newest first. */
export function recentNewsAcross(since: Date, limit = 12): NewsItem[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM news_cache WHERE published_at >= ? ORDER BY published_at DESC LIMIT ?",
    )
    .all(since.toISOString(), limit) as NewsRow[];
  return rows.map((r) => ({
    id: r.id, symbol: r.symbol, headline: r.headline, summary: r.summary,
    source: r.source, url: r.url ?? undefined, publishedAt: r.published_at,
    sentiment: r.sentiment, impact: r.impact,
  }));
}
