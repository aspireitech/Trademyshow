"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { StockInfo } from "@/lib/types";

/**
 * Global stock lookup. Lets a user analyze any single stock directly,
 * without having to create a group first.
 */
export default function StockSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: StockInfo[] }) => setResults(d.results));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{ position: "relative", maxWidth: 460 }}>
      <input
        className="input"
        placeholder="Look up any stock — symbol or company name"
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
                router.push(`/dashboard/stocks/${r.symbol}`);
              }}
            >
              <strong>{r.symbol}</strong> <span className="dim">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
