import Link from "next/link";
import MarketDataBadge from "./MarketDataBadge";
import {
  marketBreadth, moverView, VIEW_LABELS, type Mover, type MoverView,
} from "@/lib/insight/movers";
import { getHistory, getQuote } from "@/lib/marketdata";
import { currentUser } from "@/lib/auth";
import { effectiveLimits } from "@/lib/plans";

/**
 * The full market dashboard: index strip, breadth, and a 50-row screen.
 *
 * Server-rendered, because this is the proof the product does something — it
 * belongs in the HTML, visible before any JavaScript runs and readable by a
 * crawler. Every number on it comes from the same engine as the paid insights.
 */

function sparkPath(values: number[], w = 110, h = 30): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** 1.23B / 45.6M / 789K — the way every market screen abbreviates size. */
function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

const BAND_CLASS: Record<string, string> = {
  "very strong": "band-vstrong",
  strong: "band-strong",
  mixed: "band-mixed",
  weak: "band-weak",
  "very weak": "band-vweak",
};

const INDEXES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "IWM", label: "Russell 2000" },
  { symbol: "BTC-USD", label: "Bitcoin" },
];

const VIEWS: MoverView[] = ["gainers", "losers", "active", "high52", "low52"];

/** The 52-week screens beyond this depth are a paid feature. */
const PUBLIC_52W_ROWS = 15;

export default async function MarketsDashboard({
  view,
  basePath = "/markets",
}: {
  view: MoverView;
  /**
   * Where the screen tabs point. The home page keeps them on itself with a
   * query string so the landing dashboard can switch screens without sending
   * the visitor to a different page; everywhere else they are real routes.
   */
  basePath?: string;
}) {
  const user = await currentUser();
  const unlocked = user ? effectiveLimits(user).advancedMovers : false;
  const is52 = view === "high52" || view === "low52";
  const limit = is52 && !unlocked ? PUBLIC_52W_ROWS : 50;

  const rows = moverView(view, limit);
  const breadth = marketBreadth();
  const net = breadth.advancing - breadth.declining;

  return (
    <section className="mkt">
      <div className="mkt-indexes">
        {INDEXES.map((ix) => {
          const q = getQuote(ix.symbol);
          const hist = getHistory(ix.symbol, "1M").map((pt) => pt.price);
          const up = q.changePct >= 0;
          return (
            <Link key={ix.symbol} href={`/stocks/${ix.symbol}`} className="mkt-index">
              <span className="mkt-index-name">
                <strong>{ix.symbol}</strong>
                <span className="dim">{ix.label}</span>
              </span>
              <svg viewBox="0 0 110 30" aria-hidden="true" preserveAspectRatio="none">
                <path d={sparkPath(hist)} fill="none" strokeWidth="1.6"
                  stroke={up ? "var(--gain)" : "var(--loss)"} strokeLinejoin="round" />
              </svg>
              <span className={`mono mkt-index-chg ${up ? "gain" : "loss"}`}>
                {up ? "↑" : "↓"} {up ? "+" : ""}{q.changePct.toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mkt-toolbar">
        <div className="tf-tabs mkt-tabs">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={basePath === "/" ? (v === "gainers" ? "/" : `/?view=${v}`) : `${basePath}/${v}`}
              className={v === view ? "active" : ""}
            >
              {VIEW_LABELS[v]}
            </Link>
          ))}
        </div>
        <div className="mkt-status">
          <MarketDataBadge />
        </div>
        <p className="dim mkt-breadth">
          <span className="live-dot" aria-hidden="true" />
          <strong className={net >= 0 ? "gain" : "loss"}>
            {breadth.advancing} up · {breadth.declining} down
          </strong>{" "}
          of {breadth.advancing + breadth.declining + breadth.unchanged} tracked, averaging{" "}
          <span className={breadth.averageChangePct >= 0 ? "gain" : "loss"}>
            {breadth.averageChangePct >= 0 ? "+" : ""}{breadth.averageChangePct}%
          </span>
        </p>
      </div>

      <div className="mkt-tablewrap">
        <table className="mkt-table">
          <thead>
            <tr>
              <th className="mkt-num">#</th>
              <th>Symbol</th>
              <th>Sector</th>
              <th className="mkt-right">Price</th>
              <th className="mkt-right">Today</th>
              {is52 && <th className="mkt-right">{view === "high52" ? "From 52w high" : "From 52w low"}</th>}
              <th className="mkt-right mkt-hide-sm">Volume</th>
              <th className="mkt-right mkt-hide-sm">Market cap</th>
              <th>1M trend</th>
              <th>Signals</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <Row key={m.symbol} m={m} i={i} is52={is52} view={view} />
            ))}
          </tbody>
        </table>
      </div>

      {is52 && !unlocked && (
        <div className="callout upsell" style={{ marginTop: 14 }}>
          <strong>Showing the nearest {PUBLIC_52W_ROWS}.</strong>{" "}
          <span className="dim">The full 50-row screen is included with Pro — start the free
          trial and it opens immediately.</span>{" "}
          <Link className="btn small" style={{ marginLeft: 8 }} href="/register">Start free</Link>
        </div>
      )}

      <p className="dim mkt-foot">
        The biggest moves that already happened — never sorted by our own score, and never a list
        of what to buy. Open any row to see the four measures behind its reading.
      </p>
    </section>
  );
}

function Row({ m, i, is52, view }: { m: Mover; i: number; is52: boolean; view: MoverView }) {
  const up = m.changePct >= 0;
  const dist = view === "high52" ? m.pctFrom52wHigh : m.pctFrom52wLow;
  return (
    <tr className="board-row">
      <td className="mkt-num mono dim">{i + 1}</td>
      <td>
        <Link href={`/stocks/${m.symbol}`} className="mkt-sym">
          <strong>{m.symbol}</strong>
          {m.assetClass !== "stock" && (
            <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>
              {m.assetClass.toUpperCase()}
            </span>
          )}
          <span className="dim mkt-name">{m.name}</span>
        </Link>
      </td>
      <td className="dim mkt-sector">{m.sector}</td>
      <td className="mono mkt-right">${m.price.toFixed(2)}</td>
      <td className={`mono mkt-right board-change ${up ? "gain" : "loss"}`}>
        {up ? "▲" : "▼"} {up ? "+" : ""}{m.changePct.toFixed(2)}%
      </td>
      {is52 && (
        <td className={`mono mkt-right ${dist >= 0 ? "gain" : "loss"}`}>
          {dist >= 0 ? "+" : ""}{dist.toFixed(1)}%
        </td>
      )}
      <td className="mono mkt-right dim mkt-hide-sm">{compact(m.volume)}</td>
      <td className="mono mkt-right dim mkt-hide-sm">${compact(m.marketCap)}</td>
      <td>
        <svg className="board-spark" viewBox="0 0 110 30" aria-hidden="true" preserveAspectRatio="none">
          <path d={sparkPath(m.spark)} fill="none" strokeWidth="1.6"
            stroke={up ? "var(--gain)" : "var(--loss)"} strokeLinejoin="round" />
        </svg>
      </td>
      <td>{m.band && <span className={`board-band ${BAND_CLASS[m.band] ?? ""}`}>{m.band}</span>}</td>
    </tr>
  );
}
