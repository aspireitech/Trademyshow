"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Mover {
  symbol: string; name: string; sector: string; assetClass: string;
  price: number; changePct: number; score: number | null; band: string | null;
}
interface Payload {
  asOf: string;
  gainers: Mover[]; losers: Mover[]; mostActive: Mover[];
  breadth: { advancing: number; declining: number; unchanged: number; averageChangePct: number };
}

/**
 * What moved today, market-wide.
 *
 * Deliberately descriptive: these are the biggest moves that already happened,
 * not a list of what to buy. The Insight Score sits alongside each row as
 * context, not as a ranking — sorting by score would turn a factual table into
 * a recommendation, which is the one thing this product does not do.
 */
export default function MarketMovers() {
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<"gainers" | "losers" | "mostActive">("gainers");

  useEffect(() => {
    void fetch("/api/market/movers?limit=6")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Payload | null) => setData(d));
  }, []);

  if (!data) {
    return (
      <section className="card">
        <h3>What moved today</h3>
        <p className="dim" style={{ fontSize: 14 }}>Loading…</p>
      </section>
    );
  }

  const rows = data[tab];
  const { breadth } = data;
  const net = breadth.advancing - breadth.declining;

  return (
    <section className="card">
      <div className="sec-head">
        <h3>What moved today</h3>
        <span className="dim" style={{ fontSize: 12 }}>{data.asOf}</span>
      </div>

      <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
        <strong className={net >= 0 ? "gain" : "loss"}>
          {breadth.advancing} up, {breadth.declining} down
        </strong>{" "}
        across the {breadth.advancing + breadth.declining + breadth.unchanged} instruments we track,
        averaging{" "}
        <span className={breadth.averageChangePct >= 0 ? "gain" : "loss"}>
          {breadth.averageChangePct >= 0 ? "+" : ""}{breadth.averageChangePct}%
        </span>
        . Useful context: a holding down 1% on a day like this is a different story from one falling alone.
      </p>

      <div className="tf-tabs" style={{ marginTop: 12 }}>
        {([["gainers", "Risers"], ["losers", "Fallers"], ["mostActive", "Biggest moves"]] as const).map(
          ([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ),
        )}
      </div>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="holdings">
          <thead>
            <tr><th>Stock</th><th>Price</th><th>Today</th><th>Score</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.symbol}>
                <td>
                  <Link href={`/dashboard/stocks/${m.symbol}`}><strong>{m.symbol}</strong></Link>
                  {m.assetClass !== "stock" && (
                    <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>
                      {m.assetClass.toUpperCase()}
                    </span>
                  )}
                  <br />
                  <span className="dim" style={{ fontSize: 12 }}>{m.name}</span>
                </td>
                <td className="mono">${m.price.toFixed(2)}</td>
                <td className={`mono ${m.changePct >= 0 ? "gain" : "loss"}`}>
                  {m.changePct >= 0 ? "+" : ""}{m.changePct.toFixed(2)}%
                </td>
                <td className="mono dim">{m.score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
        Biggest moves that already happened, not a list of what to buy. Scores are shown as context
        and the table is never sorted by them.
      </p>
    </section>
  );
}
