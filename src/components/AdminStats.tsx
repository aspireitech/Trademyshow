"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface Visitors {
  uniqueToday: number; returningToday: number;
  uniqueLast30: number; visitsLast30: number; repeatRatePct: number;
  totalViews: number; uniqueVisitorDays: number;
  repeatVisitorDays: number; activeDays: number;
}

interface MarketData {
  provider: string;
  coverage: { covered: number; total: number; pct: number };
  historyMissing: boolean;
  lastRunAt: string | null;
  sample: {
    symbol: string; price: number; source: string; text: string;
    ageHours: number | null; exchange: string | null;
  }[];
}

interface Stats {
  users: { total: number; verified: number; newLast30: number; activeLast7: number };
  plans: { free: number; trialing: number; pro: number; premium: number };
  revenue: { payingUsers: number; mrrUsd: number; arpuUsd: number; conversionPct: number };
  content: { watchlists: number; holdings: number; insights: number; alerts: number };
  referrals: { pending: number; converted: number };
}

export default function AdminStats() {
  const [s, setStats] = useState<Stats | null>(null);
  const [v, setVisitors] = useState<Visitors | null>(null);
  const [md, setMarketData] = useState<MarketData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function loadMarketData() {
    void apiFetch("/api/market/refresh")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MarketData | null) => setMarketData(d));
  }

  useEffect(() => {
    void apiFetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Stats | null) => setStats(d));
    void apiFetch("/api/visits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Visitors | null) => setVisitors(d));
    loadMarketData();
  }, []);

  async function refreshPrices() {
    setRefreshing(true);
    await apiFetch("/api/market/refresh", { method: "POST" }).catch(() => null);
    setRefreshing(false);
    loadMarketData();
  }

  if (!s) return <p className="dim">Loading…</p>;

  const verifiedPct = s.users.total ? (s.users.verified / s.users.total) * 100 : 0;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="card">
        <h3>Revenue</h3>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <Stat label="MRR" value={`$${s.revenue.mrrUsd.toFixed(0)}`} tone="good" />
          <Stat label="Paying users" value={String(s.revenue.payingUsers)} />
          <Stat label="ARPU" value={`$${s.revenue.arpuUsd.toFixed(2)}`} />
          <Stat
            label="Free → paid"
            value={`${s.revenue.conversionPct}%`}
            tone={s.revenue.conversionPct >= 3 ? "good" : "warn"}
          />
          <Stat label="On trial" value={String(s.plans.trialing)} />
          <Stat label="Annual run rate" value={`$${(s.revenue.mrrUsd * 12).toFixed(0)}`} />
        </div>
      </section>

      {md && (
        <section className="card">
          <h3>Market data</h3>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
            Whether the prices on the site are real, and how you can tell. Coverage is the share
            of tracked instruments carrying a quote from a vendor; anything not covered falls
            back to the simulation and every screen showing it says so.
          </p>

          <div className="grid cols-3" style={{ marginTop: 12 }}>
            <Stat label="Provider" value={md.provider} />
            <Stat
              label="Coverage"
              value={`${md.coverage.pct}%`}
              tone={md.coverage.pct >= 90 ? "good" : md.coverage.pct >= 40 ? "warn" : "bad"}
            />
            <Stat label="Instruments priced" value={`${md.coverage.covered} / ${md.coverage.total}`} />
            <Stat
              label="Daily history"
              value={
                md.provider === "mock" ? "n/a — simulation" : md.historyMissing ? "missing" : "present"
              }
              tone={md.provider === "mock" ? "warn" : md.historyMissing ? "bad" : "good"}
            />
            <Stat
              label="Last refresh"
              value={md.lastRunAt ? new Date(md.lastRunAt).toLocaleTimeString() : "not this process"}
            />
          </div>

          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>We show</th>
                  <th>Age</th>
                  <th>Exchange</th>
                  <th>Source</th>
                  <th>Check against</th>
                </tr>
              </thead>
              <tbody>
                {md.sample.map((row) => (
                  <tr key={row.symbol}>
                    <td><strong>{row.symbol}</strong></td>
                    <td className="mono">${row.price.toFixed(2)}</td>
                    <td className="mono dim">
                      {row.ageHours === null ? "—" : `${row.ageHours.toFixed(1)}h`}
                    </td>
                    <td className="dim">{row.exchange ?? "—"}</td>
                    <td>
                      <span className={`src-pill ${row.source === "simulated" ? "sim" : "real"}`}>
                        {row.text}
                      </span>
                    </td>
                    <td>
                      {/* The only check that settles it is a person comparing two
                          numbers, so link straight to one. */}
                      <a
                        href={`https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Yahoo →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 12 }}>
            <button className="btn small" onClick={() => void refreshPrices()} disabled={refreshing}>
              {refreshing ? "Fetching…" : "Refresh prices now"}
            </button>{" "}
            <span className="dim" style={{ fontSize: 12.5 }}>
              Or from a terminal: <code>npm run verify:prices</code> compares every figure with
              the vendor and tells you where they disagree.
            </span>
          </p>
        </section>
      )}

      {v && (
        <section className="card">
          <h3>Traffic</h3>
          <p className="dim" style={{ fontSize: 13, marginTop: 4 }}>
            Counted server-side, so ad blockers do not distort it. Visitors are identified by a
            hash that rotates daily — enough to count returns within a day, not enough to build a
            profile of anyone.
          </p>
          <div className="grid cols-3" style={{ marginTop: 12 }}>
            <Stat label="Total views (all time)" value={v.totalViews.toLocaleString()} />
            <Stat label="Visitor-days (all time)" value={v.uniqueVisitorDays.toLocaleString()} />
            <Stat label="Repeat visitor-days" value={v.repeatVisitorDays.toLocaleString()}
              tone={v.repeatVisitorDays > 0 ? "good" : undefined} />
            <Stat label="Unique today" value={String(v.uniqueToday)} />
            <Stat label="Returned today" value={String(v.returningToday)}
              tone={v.returningToday > 0 ? "good" : undefined} />
            <Stat label="Unique (30d)" value={String(v.uniqueLast30)} />
            <Stat label="Page views (30d)" value={String(v.visitsLast30)} />
            <Stat label="Pages per visitor" value={
              v.uniqueLast30 ? (v.visitsLast30 / v.uniqueLast30).toFixed(1) : "0"
            } tone={v.visitsLast30 / Math.max(1, v.uniqueLast30) >= 3 ? "good" : "warn"} />
            <Stat label="Signup rate" value={
              v.uniqueLast30 ? `${((s.users.newLast30 / v.uniqueLast30) * 100).toFixed(1)}%` : "—"
            } />
          </div>
        </section>
      )}

      <section className="card">
        <h3>Users</h3>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <Stat label="Total" value={String(s.users.total)} />
          <Stat label="New (30d)" value={String(s.users.newLast30)} tone="good" />
          <Stat label="Active (7d)" value={String(s.users.activeLast7)} />
          <Stat
            label="Email verified"
            value={`${verifiedPct.toFixed(0)}%`}
            tone={verifiedPct >= 60 ? "good" : "warn"}
          />
          <Stat label="Pro" value={String(s.plans.pro)} />
          <Stat label="Premium" value={String(s.plans.premium)} />
        </div>
      </section>

      <section className="card">
        <h3>Usage</h3>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <Stat label="Watchlists" value={String(s.content.watchlists)} />
          <Stat label="Holdings tracked" value={String(s.content.holdings)} />
          <Stat label="Insights written" value={String(s.content.insights)} />
          <Stat label="Alerts set" value={String(s.content.alerts)} />
          <Stat label="Referred signups" value={String(s.referrals.pending)} />
          <Stat label="Referrals converted" value={String(s.referrals.converted)} tone="good" />
        </div>
      </section>
    </div>
  );
}

/** "bad" exists because some states — no live prices at all — are not a warning. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ""}`}>
      <strong>{value}</strong>
      <span className="dim">{label}</span>
    </div>
  );
}
