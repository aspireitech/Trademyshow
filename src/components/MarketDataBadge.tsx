"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

/**
 * Says where the numbers on this screen came from, and fills the cache when
 * they came from nowhere.
 *
 * A fresh installation starts with an empty cache, which means simulated
 * prices until something fetches real ones. Rather than leaving that to a
 * scheduler nobody has set up yet, the first visitor's browser asks the server
 * to fill it and the page reloads with real data. It happens once.
 *
 * The badge stays visible afterwards because the honest label is the point:
 * anyone reading a price here can tell at a glance whether it is real.
 */

interface Status {
  provider: string;
  coverage: { covered: number; total: number; pct: number };
  historyMissing: boolean;
  lastRunAt: string | null;
}

export default function MarketDataBadge() {
  const [status, setStatus] = useState<Status | null>(null);
  const [filling, setFilling] = useState(false);
  const [tried, setTried] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/market/refresh");
    if (res.ok) setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fill = useCallback(async () => {
    setFilling(true);
    const res = await apiFetch("/api/market/refresh", { method: "POST" });
    setFilling(false);
    setTried(true);
    if (res.ok) {
      // A full refresh rewrites every row on the page, and re-rendering from
      // the server is both simpler and more honest than patching the table.
      window.location.reload();
      return;
    }
    void load();
  }, [load]);

  // Empty cache, live provider configured: fetch once, unprompted.
  useEffect(() => {
    if (!status || tried || filling) return;
    if (status.provider === "mock") return;
    if (status.coverage.pct >= 40) return;
    void fill();
  }, [status, tried, filling, fill]);

  if (!status) return null;

  if (status.provider === "mock") {
    return (
      <span className="src-pill sim" title="MARKET_DATA_PROVIDER=mock">
        Simulated data · not real quotes
      </span>
    );
  }

  if (filling) {
    return <span className="src-pill">Fetching live prices…</span>;
  }

  const { covered, total, pct } = status.coverage;

  if (pct >= 40) {
    return (
      <span className="src-pill real" title={`${covered} of ${total} instruments have a real quote`}>
        Live data · {pct}% of {total} instruments
      </span>
    );
  }

  return (
    <span className="src-pill sim">
      Simulated — no live quotes cached{" "}
      <button type="button" className="linkish" onClick={() => void fill()}>
        fetch now
      </button>
    </span>
  );
}
