"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PortfolioDonut from "./PortfolioDonut";
import { downloadCsv } from "@/lib/csv";
import { allocationSlices, type AllocationSlice } from "@/lib/portfolio";
import type { DigestFacts } from "@/lib/types";

interface GroupSummary {
  id: number;
  name: string;
  holdingsCount: number;
  totalValue: number;
  changePct: number;
}

/** Legend rows shared by the rollup donut and every per-portfolio donut. */
function Legend({ slices }: { slices: AllocationSlice[] }) {
  return (
    <ul className="donut-legend">
      {slices.map((s) => (
        <li key={s.label}>
          <span className="compare-swatch" style={{ background: s.color }} />
          <span className="donut-legend-label">{s.label}</span>
          <span className="dim mono">{s.pct.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function PortfolioOverview() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [facts, setFacts] = useState<Record<number, DigestFacts>>({});

  useEffect(() => {
    void fetch("/api/groups")
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d: { groups: GroupSummary[] }) => setGroups(d.groups));
  }, []);

  useEffect(() => {
    if (!groups) return;
    let cancelled = false;
    void (async () => {
      const next: Record<number, DigestFacts> = {};
      await Promise.all(
        groups.map(async (g) => {
          const res = await fetch(`/api/groups/${g.id}`);
          if (res.ok) {
            const body = (await res.json()) as { facts: DigestFacts };
            next[g.id] = body.facts;
          }
        }),
      );
      if (!cancelled) setFacts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [groups]);

  if (!groups) return <p className="dim">Loading portfolios…</p>;

  if (groups.length === 0) {
    return (
      <div className="card">
        <p className="dim">
          No portfolios yet. Create one from the dashboard and add a symbol with the number of
          shares you hold — that turns a watchlist into a portfolio with a real dollar value.
        </p>
      </div>
    );
  }

  const totalValue = groups.reduce((sum, g) => sum + g.totalValue, 0);
  const rollupSlices = allocationSlices(groups.map((g) => ({ label: g.name, value: g.totalValue })));

  function exportAllCsv() {
    downloadCsv("portfolios", [
      ["Portfolio", "Symbol", "Name", "Shares", "Price", "Value", "Today %"],
      ...(groups ?? []).flatMap((g) =>
        (facts[g.id]?.holdings ?? []).map((h) => [
          g.name,
          h.symbol,
          h.name,
          h.quantity,
          h.price.toFixed(2),
          h.value.toFixed(2),
          h.changePct.toFixed(2),
        ]),
      ),
    ]);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <div className="sec-head">
          <h3>All portfolios</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p className="mono" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              ${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <button type="button" className="btn small secondary" onClick={exportAllCsv}>
              Export CSV
            </button>
          </div>
        </div>
        <p className="dim" style={{ fontSize: 14, marginTop: 4 }}>
          Every portfolio you hold, combined into one number. Priced with the same delayed
          quotes shown throughout the site — see each stock&apos;s page for its source.
        </p>
        <div className="donut-row" style={{ marginTop: 16 }}>
          <PortfolioDonut
            slices={rollupSlices}
            centerLabel="total"
            centerValue={`$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          />
          <Legend slices={rollupSlices} />
        </div>
      </section>

      <div className="portfolio-grid">
        {groups.map((g) => {
          const gf = facts[g.id];
          const slices = gf
            ? allocationSlices(gf.holdings.map((h) => ({ label: h.symbol, value: h.value })))
            : [];
          return (
            <Link key={g.id} href={`/dashboard/groups/${g.id}`} className="card portfolio-card">
              <div className="sec-head">
                <h4 style={{ margin: 0 }}>{g.name}</h4>
                <span className={`mono ${g.changePct >= 0 ? "gain" : "loss"}`} style={{ fontSize: 13 }}>
                  {g.changePct >= 0 ? "+" : ""}
                  {g.changePct.toFixed(2)}%
                </span>
              </div>
              <p className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                ${g.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <div className="donut-row" style={{ marginTop: 10 }}>
                <PortfolioDonut slices={slices} />
                <Legend slices={slices.slice(0, 5)} />
              </div>
              <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
                {g.holdingsCount} position{g.holdingsCount === 1 ? "" : "s"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
