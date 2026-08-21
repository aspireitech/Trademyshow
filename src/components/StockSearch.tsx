"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { StockInfo } from "@/lib/types";

/** Short label so a fund or a coin is not mistaken for a single company. */
function assetLabel(assetClass?: string): string | null {
  return assetClass && assetClass !== "stock" ? assetClass.toUpperCase() : null;
}

/**
 * Global stock lookup. Lets a user analyze any single stock directly,
 * without having to create a group first.
 */
export default function StockSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: StockInfo[] }) => {
          setResults(d.results);
          setSearched(true);
        });
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ position: "relative", maxWidth: 460 }}>
      <input
        className="input"
        placeholder="Look up any stock, ETF or coin — symbol or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search stocks"
      />
      {results.length > 0 && (
        <div className="lookup">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => {
                setQ("");
                setResults([]);
                router.push(`/stocks/${r.symbol}`);
              }}
            >
              <strong>{r.symbol}</strong> <span className="dim">{r.name}</span>
              {assetLabel(r.assetClass) && (
                <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>
                  {assetLabel(r.assetClass)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {searched && results.length === 0 && (
        <div className="lookup">
          <p className="dim" style={{ padding: "10px 12px", margin: 0, fontSize: 13 }}>
            Nothing matching &ldquo;{q}&rdquo;. Try a ticker like AAPL, a fund like SPY, or a
            sector like &ldquo;energy&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
