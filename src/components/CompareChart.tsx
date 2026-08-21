"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TIMEFRAMES, type StockInfo, type Timeframe } from "@/lib/types";

interface Series {
  symbol: string; name: string; sector: string;
  points: { t: string; pct: number }[];
  totalReturnPct: number; score: number | null; band: string | null;
}
interface Comparison {
  timeframe: Timeframe; series: Series[];
  bestSymbol: string | null; worstSymbol: string | null; spreadPct: number;
}

/** Distinguishable in both themes and to the most common colour deficiencies. */
const LINE_COLOURS = ["#2563eb", "#e8710a", "#0f766e", "#a21caf"];

const W = 720;
const H = 260;
const PAD = { top: 14, right: 54, bottom: 22, left: 8 };

export default function CompareChart({ initial }: { initial: string[] }) {
  const [symbols, setSymbols] = useState<string[]>(initial);
  const [range, setRange] = useState<Timeframe>("1Y");
  const [data, setData] = useState<Comparison | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (symbols.length === 0) { setData(null); return; }
    const res = await fetch(`/api/stocks/compare?symbols=${symbols.join(",")}&range=${range}`);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Could not compare those.");
      return;
    }
    setError(null);
    setData((await res.json()) as Comparison);
  }, [symbols, range]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      void fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: StockInfo[] }) => setResults(d.results));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function add(symbol: string) {
    setQuery(""); setResults([]);
    if (symbols.includes(symbol)) return;
    if (symbols.length >= 4) { setError("Compare up to 4 at a time."); return; }
    setSymbols([...symbols, symbol]);
  }

  // Shared scale across every series, or the lines would not be comparable.
  const all = data?.series.flatMap((s) => s.points.map((p) => p.pct)) ?? [];
  const min = all.length ? Math.min(...all, 0) : 0;
  const max = all.length ? Math.max(...all, 0) : 1;
  const span = max - min || 1;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number, n: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (pct: number) => PAD.top + plotH - ((pct - min) / span) * plotH;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <div className="sec-head">
          <h3>Compare</h3>
          <div className="tf-tabs">
            {TIMEFRAMES.filter((t) => t !== "1D").map((t) => (
              <button key={t} className={t === range ? "active" : ""} onClick={() => setRange(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <p className="dim" style={{ fontSize: 14, marginTop: 6 }}>
          Everything is rebased to 0% at the start of the window. Comparing raw prices would tell
          you which share costs more, not which moved more.
        </p>

        <div className="compare-chips">
          {symbols.map((s, i) => (
            <span key={s} className="compare-chip" style={{ borderColor: LINE_COLOURS[i % 4] }}>
              <span className="compare-swatch" style={{ background: LINE_COLOURS[i % 4] }} />
              {s}
              <button onClick={() => setSymbols(symbols.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                ✕
              </button>
            </span>
          ))}
          {symbols.length < 4 && (
            <span style={{ position: "relative" }}>
              <input
                className="input"
                style={{ maxWidth: 190 }}
                placeholder="Add a symbol…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Add a symbol to compare"
              />
              {results.length > 0 && (
                <div className="lookup">
                  {results.slice(0, 6).map((r) => (
                    <button key={r.symbol} onClick={() => add(r.symbol)}>
                      <strong>{r.symbol}</strong> <span className="dim">{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </span>
          )}
        </div>
        {error && <p className="error">{error}</p>}

        {data && data.series.length > 0 && (
          <>
            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="compare-svg"
                role="img"
                aria-label={`${data.series.map((s) => `${s.symbol} ${s.totalReturnPct}%`).join(", ")} over ${range}`}
              >
                {/* Zero line: the reference every series is measured against. */}
                <line x1={PAD.left} x2={PAD.left + plotW} y1={y(0)} y2={y(0)}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <text x={PAD.left + plotW + 6} y={y(0) + 4} className="compare-axis">0%</text>

                {data.series.map((s, si) => {
                  const d = s.points
                    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i, s.points.length).toFixed(1)},${y(p.pct).toFixed(1)}`)
                    .join(" ");
                  const last = s.points[s.points.length - 1];
                  return (
                    <g key={s.symbol}>
                      <path d={d} fill="none" stroke={LINE_COLOURS[si % 4]} strokeWidth="2"
                        strokeLinejoin="round" strokeLinecap="round" />
                      <circle cx={x(s.points.length - 1, s.points.length)} cy={y(last.pct)} r="3.5"
                        fill={LINE_COLOURS[si % 4]} />
                      <text x={PAD.left + plotW + 6} y={y(last.pct) + 4}
                        className="compare-label" fill={LINE_COLOURS[si % 4]}>
                        {last.pct >= 0 ? "+" : ""}{last.pct.toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ overflowX: "auto", marginTop: 14 }}>
              <table className="holdings">
                <thead>
                  <tr><th>Instrument</th><th>Sector</th><th>{range} return</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {data.series.map((s, i) => (
                    <tr key={s.symbol}>
                      <td>
                        <span className="compare-swatch" style={{ background: LINE_COLOURS[i % 4] }} />
                        <Link href={`/dashboard/stocks/${s.symbol}`}><strong>{s.symbol}</strong></Link>
                        <br />
                        <span className="dim" style={{ fontSize: 12 }}>{s.name}</span>
                      </td>
                      <td className="dim" style={{ fontSize: 13 }}>{s.sector}</td>
                      <td className={`mono ${s.totalReturnPct >= 0 ? "gain" : "loss"}`}>
                        {s.totalReturnPct >= 0 ? "+" : ""}{s.totalReturnPct.toFixed(2)}%
                      </td>
                      <td className="mono dim">{s.score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.series.length > 1 && (
              <p className="dim" style={{ fontSize: 13, marginTop: 12 }}>
                Over {range}, <strong>{data.bestSymbol}</strong> is{" "}
                <strong>{data.spreadPct.toFixed(1)} points</strong> ahead of{" "}
                <strong>{data.worstSymbol}</strong>. That gap is what happened, not a judgement
                about which is the better holding.
              </p>
            )}
          </>
        )}

        {data && data.series.length === 0 && (
          <p className="dim" style={{ marginTop: 14, fontSize: 14 }}>
            Add a symbol above to start comparing.
          </p>
        )}
      </section>
    </div>
  );
}
