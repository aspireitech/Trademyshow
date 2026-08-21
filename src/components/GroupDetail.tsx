"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sparkline from "./Sparkline";
import type { Digest, DigestFacts, DigestPeriod, Holding, StockInfo, Timeframe } from "@/lib/types";
import { TIMEFRAMES } from "@/lib/types";
import { apiFetch } from "@/lib/apiClient";

interface GroupResponse {
  group: { id: number; name: string };
  holdings: Holding[];
  facts: DigestFacts;
}

interface StockDetail {
  history: { t: string; price: number }[];
  trends: Record<Timeframe, number>;
}

const WRITER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  anthropic: "Claude",
  openai: "GPT",
  template: "rules engine",
};

export default function GroupDetail({ groupId }: { groupId: number }) {
  const [data, setData] = useState<GroupResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tf, setTf] = useState<Timeframe>("1M");
  const [details, setDetails] = useState<Record<string, StockDetail>>({});
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);
  const [period, setPeriod] = useState<DigestPeriod>("daily");
  const [error, setError] = useState<string | null>(null);

  // search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    setData((await res.json()) as GroupResponse);
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [groupId, load]);

  // Load whichever cadence the user is viewing.
  useEffect(() => {
    setDigest(null);
    void fetch(`/api/groups/${groupId}/digest?period=${period}`)
      .then((r) => (r.ok ? r.json() : { digest: null }))
      .then((d: { digest: Digest | null }) => setDigest(d.digest));
  }, [groupId, period]);

  // Load per-symbol history whenever holdings or timeframe change.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, StockDetail> = {};
      await Promise.all(
        data.holdings.map(async (h) => {
          const res = await fetch(`/api/stocks/${h.symbol}?range=${tf}`);
          if (res.ok) next[h.symbol] = (await res.json()) as StockDetail;
        }),
      );
      if (!cancelled) setDetails(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, tf]);

  // Debounced stock search.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: StockInfo[] }) => setResults(d.results));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  async function addStock(symbol: string) {
    setError(null);
    const res = await apiFetch(`/api/groups/${groupId}/holdings`, {
      method: "POST",
      body: JSON.stringify({ symbol, quantity: 1 }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not add stock");
      return;
    }
    setQuery("");
    setResults([]);
    await load();
  }

  async function removeStock(symbol: string) {
    await apiFetch(`/api/groups/${groupId}/holdings?symbol=${symbol}`, { method: "DELETE" });
    await load();
  }

  async function generateDigest() {
    setDigestBusy(true);
    setError(null);
    const res = await apiFetch(`/api/groups/${groupId}/digest?period=${period}`, { method: "POST" });
    setDigestBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not generate digest");
      return;
    }
    const d = (await res.json()) as { digest: Digest };
    setDigest(d.digest);
  }

  if (notFound) {
    return (
      <p>
        Group not found. <Link href="/dashboard">Back to dashboard</Link>
      </p>
    );
  }
  if (!data) return <p className="dim">Loading…</p>;

  const { group, facts } = data;

  return (
    <div>
      <p style={{ marginBottom: 6 }}>
        <Link href="/dashboard" className="dim">
          ← All groups
        </Link>
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
        <h2>{group.name}</h2>
        <p className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
          ${facts.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
          <span className={facts.changePct >= 0 ? "gain" : "loss"} style={{ fontSize: 15 }}>
            {facts.changePct >= 0 ? "+" : ""}
            {facts.changePct.toFixed(2)}% today
          </span>
        </p>
      </div>

      {/* Digest */}
      <div className="card" style={{ margin: "18px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>AI insight</h3>
          <div className="tf-tabs">
            {(["daily", "weekly"] as DigestPeriod[]).map((p) => (
              <button key={p} className={p === period ? "active" : ""} onClick={() => setPeriod(p)}>
                {p === "daily" ? "Daily" : "Weekly"}
              </button>
            ))}
          </div>
          <button className="btn small" onClick={generateDigest} disabled={digestBusy || data.holdings.length === 0}>
            {digestBusy ? "Analyzing…" : digest ? "Refresh digest" : "Generate digest"}
          </button>
        </div>
        {digest ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 700 }}>{digest.headline}</p>
            <p className="dim" style={{ whiteSpace: "pre-line", marginTop: 8, fontSize: 14 }}>
              {digest.body}
            </p>
            <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
              {digest.asOf} · written by {WRITER_LABELS[digest.writer] ?? digest.writer}
            </p>
          </div>
        ) : (
          <p className="dim" style={{ marginTop: 10, fontSize: 14 }}>
            Generate a {period} insight to get a plain-language explanation of what moved this
            group and why.
          </p>
        )}
      </div>

      {/* Add stock */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Add a stock</h3>
        <input
          className="input"
          placeholder="Search by symbol or company name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {results.map((r) => (
              <button key={r.symbol} className="btn small secondary" onClick={() => addStock(r.symbol)}>
                + {r.symbol} <span className="dim">{r.name}</span>
                {r.assetClass && r.assetClass !== "stock" && (
                  <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>
                    {r.assetClass.toUpperCase()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      {/* Holdings */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Holdings &amp; trends</h3>
          <div className="tf-tabs">
            {TIMEFRAMES.map((t) => (
              <button key={t} className={t === tf ? "active" : ""} onClick={() => setTf(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {facts.holdings.length === 0 ? (
          <div style={{ marginTop: 12 }}>
            <p className="dim">
              Nothing in this watchlist yet. Add two or three and the daily insight starts
              explaining what moved them.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              <span className="dim" style={{ fontSize: 13, alignSelf: "center" }}>
                Popular starting points:
              </span>
              {["SPY", "AAPL", "NVDA", "MSFT", "BTC-USD"].map((sym) => (
                <button key={sym} className="btn small secondary" onClick={() => addStock(sym)}>
                  + {sym}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Stock</th>
                  <th>Price</th>
                  <th>Today</th>
                  <th>{tf} trend</th>
                  <th>{tf} %</th>
                  <th>Weight</th>
                  <th>Contribution</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {facts.holdings.map((h) => {
                  const det = details[h.symbol];
                  const tfPct = det?.trends?.[tf];
                  return (
                    <tr key={h.symbol}>
                      <td>
                        <Link href={`/stocks/${h.symbol}`}>
                          <strong>{h.symbol}</strong>
                        </Link>
                        <br />
                        <span className="dim" style={{ fontSize: 12 }}>
                          {h.name}
                        </span>
                      </td>
                      <td className="mono">${h.price.toFixed(2)}</td>
                      <td className={`mono ${h.changePct >= 0 ? "gain" : "loss"}`}>
                        {h.changePct >= 0 ? "+" : ""}
                        {h.changePct.toFixed(2)}%
                      </td>
                      <td>
                        {det ? (
                          <Sparkline values={det.history.map((p) => p.price)} ariaLabel={`${h.symbol} ${tf} trend`} />
                        ) : (
                          <span className="dim">…</span>
                        )}
                      </td>
                      <td className={`mono ${tfPct != null && tfPct >= 0 ? "gain" : "loss"}`}>
                        {tfPct != null ? `${tfPct >= 0 ? "+" : ""}${tfPct.toFixed(1)}%` : "…"}
                      </td>
                      <td className="mono dim">{(h.weight * 100).toFixed(1)}%</td>
                      <td className={`mono ${h.contributionPct >= 0 ? "gain" : "loss"}`}>
                        {h.contributionPct >= 0 ? "+" : ""}
                        {h.contributionPct.toFixed(2)}%
                      </td>
                      <td>
                        <button className="btn small secondary" onClick={() => removeStock(h.symbol)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* News */}
      {facts.holdings.some((h) => h.news.length > 0) && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Today&apos;s related news</h3>
          {facts.holdings.flatMap((h) =>
            h.news.map((n) => (
              <p key={n.id} style={{ marginTop: 10, fontSize: 14 }}>
                <span className={`badge ${n.sentiment === "positive" ? "pro" : ""}`} style={{ marginRight: 8 }}>
                  {n.symbol}
                </span>
                <strong>{n.headline}</strong>
                <br />
                <span className="dim">
                  {n.summary} — {n.source}
                </span>
              </p>
            )),
          )}
        </div>
      )}
    </div>
  );
}
