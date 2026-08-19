"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PriceChart from "./PriceChart";
import ScoreCard from "./ScoreCard";
import type { InsightScore } from "@/lib/insight/score";
import type { Expectation } from "@/lib/insight/expectation";
import { TIMEFRAMES, type NewsItem, type Quote, type StockInfo, type Timeframe } from "@/lib/types";

interface StockResponse {
  info: StockInfo;
  quote: Quote;
  history: { t: string; price: number }[];
  trends: Record<Timeframe, number>;
  news: NewsItem[];
  score: (InsightScore & { masked?: boolean }) | null;
  expectations: Expectation[] | null;
}

/** Plain-language read of the trend table — descriptive, never predictive. */
function trendSummary(trends: Record<Timeframe, number>): string {
  const long: Timeframe[] = ["1M", "3M", "6M", "1Y"];
  const ups = long.filter((t) => (trends[t] ?? 0) > 0).length;
  if (ups === long.length) return "Higher across every medium and long timeframe.";
  if (ups === 0) return "Lower across every medium and long timeframe.";
  if (ups >= 3) return "Mostly higher over the longer timeframes, with some weakness.";
  if (ups <= 1) return "Mostly lower over the longer timeframes, with some strength.";
  return "Mixed — up on some timeframes and down on others.";
}

export default function StockDetail({ symbol }: { symbol: string }) {
  const [tf, setTf] = useState<Timeframe>("1M");
  const [data, setData] = useState<StockResponse | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/stocks/${symbol}?range=${tf}`).then(async (res) => {
      if (cancelled) return;
      if (!res.ok) return setMissing(true);
      setData((await res.json()) as StockResponse);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, tf]);

  if (missing) {
    return (
      <p>
        We don&apos;t have data for &quot;{symbol}&quot;. <Link href="/dashboard">Back to dashboard</Link>
      </p>
    );
  }
  if (!data) return <p className="dim">Loading {symbol}…</p>;

  const { info, quote, history, trends, news, score, expectations } = data;
  const up = quote.changePct >= 0;

  return (
    <div>
      <p style={{ marginBottom: 6 }}>
        <Link href="/dashboard" className="dim">
          ← Dashboard
        </Link>
      </p>

      {/* Headline price */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 0 }}>
            {info.symbol} <span className="dim" style={{ fontWeight: 400, fontSize: 16 }}>{info.name}</span>
          </h2>
          <p className="dim" style={{ fontSize: 13 }}>{info.sector}</p>
        </div>
        <p className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2 }}>
          ${quote.price.toFixed(2)}{" "}
          <span className={up ? "gain" : "loss"} style={{ fontSize: 16 }}>
            {up ? "+" : ""}
            {quote.changePct.toFixed(2)}% today
          </span>
        </p>
      </div>

      {/* Insight Score */}
      {score && (
        <div style={{ marginTop: 16 }}>
          <ScoreCard score={score} expectations={expectations} />
        </div>
      )}

      {/* Chart + timeframes */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="tf-tabs" style={{ marginBottom: 12 }}>
          {TIMEFRAMES.map((t) => (
            <button key={t} className={t === tf ? "active" : ""} onClick={() => setTf(t)} aria-pressed={t === tf}>
              {t}
            </button>
          ))}
        </div>
        <PriceChart points={history} />
        <p style={{ marginTop: 10 }}>
          <span className={(trends[tf] ?? 0) >= 0 ? "gain" : "loss"} style={{ fontWeight: 700 }}>
            {(trends[tf] ?? 0) >= 0 ? "+" : ""}
            {(trends[tf] ?? 0).toFixed(2)}%
          </span>{" "}
          <span className="dim">over {tf}</span>
        </p>
      </div>

      {/* All timeframes at a glance */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Every timeframe at a glance</h3>
        <p className="dim" style={{ fontSize: 14, marginBottom: 10 }}>{trendSummary(trends)}</p>
        <div className="tf-grid">
          {TIMEFRAMES.map((t) => {
            const v = trends[t] ?? 0;
            return (
              <button key={t} className="tf-cell" onClick={() => setTf(t)} aria-label={`Show ${t} chart`}>
                <span className="dim">{t}</span>
                <strong className={`mono ${v >= 0 ? "gain" : "loss"}`}>
                  {v >= 0 ? "+" : ""}
                  {v.toFixed(1)}%
                </strong>
              </button>
            );
          })}
        </div>
      </div>

      {/* News */}
      {news.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Latest news</h3>
          {news.map((n) => (
            <p key={n.id} style={{ marginTop: 10, fontSize: 14 }}>
              <strong>{n.headline}</strong>
              <br />
              <span className="dim">
                {n.summary} — {n.source}
              </span>
            </p>
          ))}
        </div>
      )}

      <p className="dim" style={{ fontSize: 12, marginTop: 16 }}>
        Analytics and education only — not investment advice.
      </p>
    </div>
  );
}
