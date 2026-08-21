import Link from "next/link";
import { marketBreadth, marketMovers } from "@/lib/insight/movers";
import { getHistory } from "@/lib/marketdata";

/**
 * A live board on the landing page.
 *
 * Server-rendered on purpose: this is the proof that the product does
 * something, and it has to be in the HTML — visible before any JavaScript
 * runs, and readable by a crawler. A marketing page that describes analytics
 * is far less persuasive than one that is already doing it.
 *
 * Each row carries the move, a trend line and the score's band, because the
 * claim being made is "we explain movement" and the row demonstrates all three
 * parts of that at a glance.
 */
function spark(values: number[], w = 96, h = 26): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const BAND_CLASS: Record<string, string> = {
  "very strong": "band-vstrong",
  strong: "band-strong",
  mixed: "band-mixed",
  weak: "band-weak",
  "very weak": "band-vweak",
};

export default function LandingBoard() {
  const { mostActive } = marketMovers(new Date(), 6);
  const breadth = marketBreadth();
  const net = breadth.advancing - breadth.declining;

  return (
    <section className="board">
      <div className="board-head">
        <div>
          <h2>Today&apos;s board</h2>
          <p className="dim">
            <span className="live-dot" aria-hidden="true" />
            <strong className={net >= 0 ? "gain" : "loss"}>
              {breadth.advancing} up · {breadth.declining} down
            </strong>{" "}
            across everything we track, averaging{" "}
            <span className={breadth.averageChangePct >= 0 ? "gain" : "loss"}>
              {breadth.averageChangePct >= 0 ? "+" : ""}{breadth.averageChangePct}%
            </span>
          </p>
        </div>
        <Link href="/register" className="btn small">Track your own</Link>
      </div>

      <div className="board-rows">
        {mostActive.map((m, i) => {
          const history = getHistory(m.symbol, "1M").map((p) => p.price);
          const up = m.changePct >= 0;
          return (
            <div className="board-row rise" style={{ animationDelay: `${0.05 * i}s` }} key={m.symbol}>
              <span className="board-sym">
                <strong>{m.symbol}</strong>
                <span className="dim">{m.name}</span>
              </span>

              <span className="board-price mono">${m.price.toFixed(2)}</span>

              <span className={`board-change mono ${up ? "gain" : "loss"}`}>
                {up ? "▲" : "▼"} {up ? "+" : ""}{m.changePct.toFixed(2)}%
              </span>

              <svg className="board-spark" viewBox="0 0 96 26" aria-hidden="true" preserveAspectRatio="none">
                <path d={spark(history)} fill="none" strokeWidth="1.8"
                  stroke={up ? "var(--gain)" : "var(--loss)"} strokeLinejoin="round" />
              </svg>

              {m.band && (
                <span className={`board-band ${BAND_CLASS[m.band] ?? ""}`}>{m.band}</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="board-foot dim">
        The biggest moves that already happened — never sorted by our own score, and never a list
        of what to buy. Open any one to see the four measures behind its reading.
      </p>
    </section>
  );
}
