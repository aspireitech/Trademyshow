"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sparkline from "./Sparkline";

interface Row {
  symbol: string; label: string; price: number; changePct: number; history: number[];
}

/**
 * Four reference instruments across the top.
 *
 * Not decoration: the first question about any move is whether it was the
 * holding or the whole market, and having the benchmarks permanently in view
 * answers it before the user has to go looking.
 */
const REFERENCES: { symbol: string; label: string }[] = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "IWM", label: "Small cap" },
  { symbol: "AGG", label: "Bonds" },
];

export default function IndexStrip() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await Promise.all(
        REFERENCES.map(async (ref) => {
          const res = await fetch(`/api/stocks/${ref.symbol}?range=1M`);
          if (!res.ok) return null;
          const d = (await res.json()) as {
            quote: { price: number; changePct: number };
            history: { price: number }[];
          };
          return {
            symbol: ref.symbol,
            label: ref.label,
            price: d.quote.price,
            changePct: d.quote.changePct,
            history: d.history.map((p) => p.price),
          };
        }),
      );
      if (!cancelled) setRows(loaded.filter((r): r is Row => r !== null));
    })();
    return () => { cancelled = true; };
  }, []);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="index-strip" aria-label="Market benchmarks">
      {rows.map((r) => (
        <Link key={r.symbol} href={`/stocks/${r.symbol}`} className="index-tile">
          <span className="index-label">
            <strong>{r.symbol}</strong>
            <span className="dim">{r.label}</span>
          </span>
          <Sparkline values={r.history} ariaLabel={`${r.symbol} one month`} />
          <span className={`index-change mono ${r.changePct >= 0 ? "gain" : "loss"}`}>
            {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
          </span>
        </Link>
      ))}
    </div>
  );
}
