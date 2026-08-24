import Link from "next/link";
import { marketNews } from "@/lib/news";
import { moverView } from "@/lib/insight/movers";

/**
 * The dashboard's news widget — market-wide, auto-scrolling, bounded.
 *
 * Deliberately a different shape from the full /news page. That page is
 * where someone goes to browse headlines; this is a strip under the tables
 * that keeps moving so a story catches the eye without ever pushing the
 * market data below the fold. Bounded height + its own scroll is the same
 * fix as any other wide-content case on this site: the page never scrolls
 * to accommodate it, only the widget does.
 */
export default function MarketNewsFeed({ limit = 12 }: { limit?: number }) {
  const movers = moverView("active", 12).map((m) => m.symbol);
  const { items, generated } = marketNews(movers, limit);

  if (items.length === 0) return null;

  // Duplicated once so the CSS marquee can loop seamlessly at translateY(-50%).
  // Hidden by the reduced-motion rule below, which also disables the animation.
  const track = [...items, ...items];
  const seconds = Math.max(items.length * 4.5, 20);

  return (
    <section className="news-panel">
      <div className="news-head">
        <h2>Market news</h2>
        {generated && (
          <span className="src-pill sim">Generated headlines · no news feed connected</span>
        )}
      </div>

      <div className="news-ticker">
        <ul
          className="news-ticker-track"
          style={{ animationDuration: `${seconds}s` }}
        >
          {track.map((n, i) => (
            <li key={`${n.id}-${i}`} className={i >= items.length ? "news-ticker-dup" : undefined}>
              <Link href={`/stocks/${n.symbol}`} className="news-row">
                <span className={`sent ${n.sentiment}`} title={`${n.sentiment} tone`} />
                <span className="news-row-body">
                  <span className="news-row-top">
                    <span className="news-sym">{n.symbol}</span>
                    <span className="dim news-time">
                      {new Date(n.publishedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="news-row-title">{n.headline}</span>
                  <span className="dim news-row-src">{n.source}</span>
                </span>
                <span className="news-row-arrow" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
