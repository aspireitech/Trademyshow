"use client";

import { useEffect, useState } from "react";
import PriceChart from "../PriceChart";
import type { Timeframe } from "@/lib/types";

/**
 * The chart with nothing else on the page.
 *
 * Not a different chart — the same series, given the width. The reason this
 * page exists is that a line squeezed into a card beside a statistics table
 * hides exactly the detail someone opens a chart to look for.
 */

const RANGES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "ALL"];
const LABEL: Record<string, string> = { "1W": "5D", ALL: "MAX" };

interface Payload {
  history: { t: string; price: number }[];
  quote: { price: number; changePct: number; prevClose: number };
  trends: Record<Timeframe, number>;
  source: { text: string; source: string };
}

export default function FullChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Timeframe>("1Y");
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/stocks/${encodeURIComponent(symbol)}?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => {
        if (!cancelled && d) setData(d);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  if (!data) return <p className="dim">Loading chart…</p>;

  const change = data.trends[range] ?? 0;

  return (
    <div className="card">
      <div className="mkt-toolbar" style={{ marginBottom: 12 }}>
        <div className="tf-tabs" style={{ flexWrap: "wrap" }}>
          {RANGES.map((r) => (
            <button key={r} className={r === range ? "active" : ""} onClick={() => setRange(r)}
              aria-pressed={r === range}>
              {LABEL[r] ?? r}
            </button>
          ))}
        </div>
        <p style={{ margin: 0 }}>
          <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
            ${data.quote.price.toFixed(2)}
          </span>{" "}
          <span className={`mono ${change >= 0 ? "gain" : "loss"}`} style={{ fontWeight: 700 }}>
            {change >= 0 ? "+" : ""}{change.toFixed(2)}%
          </span>{" "}
          <span className="dim">over {LABEL[range] ?? range}</span>
        </p>
      </div>
      <PriceChart points={data.history} height={480} />
      <p className={`src-pill ${data.source.source === "simulated" ? "sim" : "real"}`}
        style={{ marginTop: 12 }}>
        {data.source.text}
      </p>
    </div>
  );
}
