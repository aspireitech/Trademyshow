import { getDb } from "../db";
import type { NewsItem, PricePoint, Quote } from "../types";

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
