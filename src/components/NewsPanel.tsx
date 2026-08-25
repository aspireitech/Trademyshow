import Link from "next/link";
import { marketNews } from "@/lib/news";
import { moverView } from "@/lib/insight/movers";

/**
 * What the market is reading, under what the market is doing.
 *
 * Kept below the tables deliberately: the numbers are why someone opened the
 * page, and headlines above them push the answer off the screen. But a market
 * screen with no story attached is half an answer, which is why this is on the
 * landing page at all rather than a page of its own nobody visits.
 */
export default function NewsPanel({ limit = 9 }: { limit?: number }) {
  const movers = moverView("active", 12).map((m) => m.symbol);
  const { items, generated } = marketNews(movers, limit);

  if (items.length === 0) return null;

  return (
    <section className="news-panel">
      <div className="news-head">
        <h2>Market news</h2>
        {generated && (
          <span className="src-pill sim">Generated headlines · no news feed connected</span>
        )}
      </div>

      <ul className="news-grid">
        {items.map((n) => (
          <li key={n.id} className="news-card">
            <div className="news-card-top">
              <Link href={`/stocks/${n.symbol}`} className="news-sym">{n.symbol}</Link>
              <span className={`sent ${n.sentiment}`} title={`${n.sentiment} tone`} />
              <span className="dim news-time">
                {new Date(n.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            {n.url ? (
              <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="news-title">
                {n.headline}
              </a>
            ) : (
              <p className="news-title">{n.headline}</p>
            )}
            <p className="dim news-src">{n.source}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
