"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PriceChart from "../PriceChart";
import ScoreCard from "../ScoreCard";
import AlertButton from "./AlertButton";
import SignupGate from "./SignupGate";
import WatchlistButton from "./WatchlistButton";
import type { InsightScore } from "@/lib/insight/score";
import type { Expectation } from "@/lib/insight/expectation";
import type { NewsItem, Quote, StockInfo, Timeframe } from "@/lib/types";

/**
 * One stock, the way a market site lays it out.
 *
 * The order is copied from what this audience already reads, because the order
 * is what makes it scannable: identity and price first, then the actions, then
 * the numbers that answer "is this cheap, is it moving, how big is it", then
 * the chart, then our own reading, then the news. Anyone arriving from
 * stockanalysis.com or Yahoo can use this page without learning anything.
 */

/** Chart ranges in the order every finance site prints them. */
const RANGES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"];

const RANGE_LABEL: Record<string, string> = { "1W": "5D", ALL: "MAX" };

interface Stats {
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string;
  exchange: string | null;
  week52High: number;
  week52Low: number;
  marketCap: number;
  marketCapEstimated: boolean;
}

export interface StockResponse {
  info: StockInfo;
  quote: Quote;
  history: { t: string; price: number }[];
  trends: Record<Timeframe, number>;
  news: NewsItem[];
  score: (InsightScore & { masked?: boolean }) | null;
  expectations: Expectation[] | null;
  stats: Stats;
  source: { source: string; vendor: string; asOf: string | null; text: string };
  signedIn: boolean;
}

function compact(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

function money(n: number | null, currency = "USD"): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const symbol = currency === "USD" ? "$" : "";
  return `${symbol}${n.toFixed(2)}`;
}

/** Where the price sits between its 52-week extremes, as a percentage. */
function rangePosition(price: number, low: number, high: number): number {
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return 50;
  return Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
}

function trendSummary(trends: Record<Timeframe, number>): string {
  const long: Timeframe[] = ["1M", "3M", "6M", "1Y"];
  const ups = long.filter((t) => (trends[t] ?? 0) > 0).length;
  if (ups === long.length) return "Higher across every medium and long timeframe.";
  if (ups === 0) return "Lower across every medium and long timeframe.";
  if (ups >= 3) return "Mostly higher over the longer timeframes, with some weakness.";
  if (ups <= 1) return "Mostly lower over the longer timeframes, with some strength.";
  return "Mixed — up on some timeframes and down on others.";
}

export default function StockView({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Timeframe>("1M");
  const [data, setData] = useState<StockResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    void fetch(`/api/stocks/${encodeURIComponent(symbol)}?range=${range}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setMissing(true);
        return;
      }
      setData((await res.json()) as StockResponse);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  if (missing) {
    return (
      <div className="card">
        <h2>We could not find {symbol}</h2>
        <p className="dim" style={{ marginTop: 6 }}>
          That symbol did not match a listed company, fund or coin. Check the ticker, or search
          for the company by name in the box above.
        </p>
        <p style={{ marginTop: 12 }}>
          <Link href="/" className="btn secondary">Back to the market</Link>
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stock-skeleton" aria-busy="true">
        <p className="dim">Loading {symbol}…</p>
      </div>
    );
  }

  const { info, quote, history, trends, news, score, expectations, stats, source } = data;
  const up = quote.changePct >= 0;
  const change = quote.price - quote.prevClose;
  const simulated = source.source === "simulated";
  const pos = rangePosition(quote.price, stats.week52Low, stats.week52High);

  return (
    <div className="stock">
      {/* ---------- identity, price, actions ---------- */}
      <div className="stock-head">
        <div className="stock-id">
          <h1>
            {info.name} <span className="stock-ticker">({info.symbol})</span>
          </h1>
          <p className="stock-meta">
            {stats.exchange ? `${stats.exchange} · ` : ""}
            {info.symbol} · {stats.currency}
            <span className={`src-pill ${simulated ? "sim" : "real"}`} style={{ marginLeft: 8 }}>
              {source.text}
            </span>
          </p>
          <p className="stock-price">
            <span className="mono">{money(quote.price, stats.currency)}</span>
            <span className={`stock-change mono ${up ? "gain" : "loss"}`}>
              {up ? "+" : ""}{change.toFixed(2)} ({up ? "+" : ""}{quote.changePct.toFixed(2)}%)
            </span>
          </p>
          {source.asOf && (
            <p className="dim stock-asof">
              As of {new Date(source.asOf).toLocaleString()}
            </p>
          )}
        </div>

        <div className="stock-actions">
          <Link className="act-btn" href={`/stocks/${encodeURIComponent(info.symbol)}/chart`}>
            <span aria-hidden="true">⛶</span> Full chart
          </Link>
          <WatchlistButton symbol={info.symbol} />
          <AlertButton symbol={info.symbol} price={quote.price} />
          {data.signedIn ? (
            <Link
              className="act-btn"
              href={`/dashboard/compare?symbols=${encodeURIComponent(info.symbol)}`}
            >
              <span aria-hidden="true">⇄</span> Compare
            </Link>
          ) : (
            <button type="button" className="act-btn" onClick={() => setGate(true)}>
              <span aria-hidden="true">⇄</span> Compare
            </button>
          )}
        </div>
      </div>

      {simulated && (
        <p className="callout" style={{ marginBottom: 14 }}>
          <strong>Simulated data.</strong>{" "}
          <span className="dim">
            No live quote reached us for {info.symbol}, so the figures below come from our
            generated series. They are internally consistent and safe to explore, but they are
            not this instrument&apos;s real prices.
          </span>
        </p>
      )}

      {/* ---------- statistics + chart ---------- */}
      <div className="stock-grid">
        <div className="card stock-stats">
          <dl>
            <div>
              <dt>Market cap{stats.marketCapEstimated ? " *" : ""}</dt>
              <dd className="mono">${compact(stats.marketCap)}</dd>
            </div>
            <div>
              <dt>Volume</dt>
              <dd className="mono">{compact(stats.volume)}</dd>
            </div>
            <div>
              <dt>Open</dt>
              <dd className="mono">{money(stats.open, stats.currency)}</dd>
            </div>
            <div>
              <dt>Previous close</dt>
              <dd className="mono">{money(quote.prevClose, stats.currency)}</dd>
            </div>
            <div>
              <dt>Day&apos;s range</dt>
              <dd className="mono">
                {stats.dayLow && stats.dayHigh
                  ? `${stats.dayLow.toFixed(2)} – ${stats.dayHigh.toFixed(2)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>52-week range</dt>
              <dd className="mono">
                {stats.week52Low.toFixed(2)} – {stats.week52High.toFixed(2)}
              </dd>
            </div>
            <div>
              <dt>Sector</dt>
              <dd>{info.sector}</dd>
            </div>
            <div>
              <dt>Signal reading</dt>
              <dd>{score ? score.band : "not enough history"}</dd>
            </div>
          </dl>

          {/* Where the price sits in its own year. One glance answers "near the
              high or near the low", which is the question the 52-week numbers
              are actually asked to settle. */}
          <div className="range-bar" aria-hidden="true">
            <span className="range-fill" style={{ left: `${pos}%` }} />
          </div>
          <p className="range-legend dim">
            <span>52w low {stats.week52Low.toFixed(2)}</span>
            <span>{pos.toFixed(0)}% of range</span>
            <span>high {stats.week52High.toFixed(2)}</span>
          </p>

          {stats.marketCapEstimated && (
            <p className="dim stock-foot">
              * Market cap is estimated from the live price and our stored share count. The feed
              in use does not publish a share count.
            </p>
          )}
        </div>

        <div className="card stock-chart">
          <div className="tf-tabs" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            {RANGES.map((r) => (
              <button
                key={r}
                className={r === range ? "active" : ""}
                onClick={() => setRange(r)}
                aria-pressed={r === range}
              >
                {RANGE_LABEL[r] ?? r}
              </button>
            ))}
          </div>
          <PriceChart points={history} height={230} />
          <p style={{ marginTop: 10 }}>
            <span className={(trends[range] ?? 0) >= 0 ? "gain" : "loss"} style={{ fontWeight: 700 }}>
              {(trends[range] ?? 0) >= 0 ? "+" : ""}
              {(trends[range] ?? 0).toFixed(2)}%
            </span>{" "}
            <span className="dim">over {RANGE_LABEL[range] ?? range}</span>
          </p>
        </div>
      </div>

      {/* ---------- every timeframe ---------- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Every timeframe at a glance</h3>
        <p className="dim" style={{ fontSize: 14, marginBottom: 10 }}>{trendSummary(trends)}</p>
        <div className="tf-grid">
          {RANGES.map((t) => {
            const v = trends[t] ?? 0;
            return (
              <button key={t} className="tf-cell" onClick={() => setRange(t)}
                aria-label={`Show the ${t} chart`}>
                <span className="dim">{RANGE_LABEL[t] ?? t}</span>
                <strong className={`mono ${v >= 0 ? "gain" : "loss"}`}>
                  {v >= 0 ? "+" : ""}{v.toFixed(1)}%
                </strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- our own reading ---------- */}
      {score && (
        <div style={{ marginTop: 16 }}>
          <ScoreCard score={score} expectations={expectations} />
        </div>
      )}

      {/* ---------- news ---------- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Latest news</h3>
        {news.length === 0 ? (
          <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>
            No headlines for {info.symbol} in the last few days.
          </p>
        ) : (
          <ul className="news-list">
            {news.map((n) => (
              <li key={n.id}>
                <span className={`sent ${n.sentiment}`} title={`${n.sentiment} tone`} />
                <div>
                  {n.url ? (
                    <a href={n.url} target="_blank" rel="noopener noreferrer nofollow">
                      {n.headline}
                    </a>
                  ) : (
                    <strong>{n.headline}</strong>
                  )}
                  <p className="dim">
                    {n.summary ? `${n.summary} — ` : ""}
                    {n.source} · {new Date(n.publishedAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>
        Analytics and education only — not investment advice. Figures shown are{" "}
        {simulated ? "simulated" : `sourced from ${source.vendor} and may be delayed`}.
      </p>

      {gate && (
        <SignupGate
          title={`Compare ${info.symbol} against anything`}
          body="A free account puts two instruments on one chart — your holding against the index, or against its closest rival — with both lines rebased so the comparison is fair."
          onClose={() => setGate(false)}
        />
      )}
    </div>
  );
}
