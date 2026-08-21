"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, apiPost } from "@/lib/apiClient";
import SignupGate from "./SignupGate";

/**
 * Price and score alerts for one symbol.
 *
 * Two kinds because they answer different questions. "Tell me if it drops
 * below $15" is a price the visitor already has in mind; "tell me when the
 * signals turn" is what this product measures and nobody else publishes. The
 * price alert is the one people ask for, and it is the reason they come back.
 */

interface AlertRow {
  id: number;
  kind: "price" | "score";
  direction: "above" | "below";
  threshold: number;
}

interface AlertState {
  alerts: AlertRow[];
  used: number;
  limit: number;
}

export default function AlertButton({ symbol, price }: { symbol: string; price: number }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<AlertState | null>(null);
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState(false);
  const [kind, setKind] = useState<"price" | "score">("price");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/alerts?symbol=${encodeURIComponent(symbol)}`);
    if (res.status === 401) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    if (res.ok) setState((await res.json()) as AlertState);
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seed the box with something sensible: a few percent above the last price
  // beats an empty field the visitor has to think about.
  useEffect(() => {
    if (kind === "price") setValue(price ? (price * 1.05).toFixed(2) : "");
    else setValue("70");
  }, [kind, price]);

  function onClick() {
    if (signedIn === false) {
      setGate(true);
      return;
    }
    setOpen((o) => !o);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const threshold = Number(value);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setError("Enter a number above zero.");
      return;
    }
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/alerts", {
      symbol, kind, direction, threshold,
    });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Could not save that alert.");
      return;
    }
    void load();
  }

  async function remove(id: number) {
    await apiFetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    void load();
  }

  const count = state?.alerts.length ?? 0;

  return (
    <div className="act-wrap">
      <button
        type="button"
        className={`act-btn${count > 0 ? " on" : ""}`}
        onClick={onClick}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 ? `Alerts · ${count}` : "Alerts"}
      </button>

      {open && signedIn && (
        <div className="act-menu wide" role="dialog" aria-label={`Alerts for ${symbol}`}>
          <p className="act-menu-title">Tell me when {symbol}</p>

          <form onSubmit={create} className="alert-form">
            <div className="seg" role="group" aria-label="What to watch">
              <button type="button" className={kind === "price" ? "on" : ""}
                onClick={() => setKind("price")}>price</button>
              <button type="button" className={kind === "score" ? "on" : ""}
                onClick={() => setKind("score")}>Insight Score</button>
            </div>
            <div className="seg" role="group" aria-label="Direction">
              <button type="button" className={direction === "above" ? "on" : ""}
                onClick={() => setDirection("above")}>goes above</button>
              <button type="button" className={direction === "below" ? "on" : ""}
                onClick={() => setDirection("below")}>drops below</button>
            </div>
            <div className="alert-value">
              <span className="dim">{kind === "price" ? "$" : "score"}</span>
              <input
                className="input"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={kind === "price" ? "Price threshold" : "Score threshold"}
              />
              <button type="submit" className="btn small" disabled={busy}>Set alert</button>
            </div>
          </form>

          {error && (
            <p className="act-note loss" role="alert">
              {error} {error.includes("Upgrade") && <Link href="/pricing">See plans →</Link>}
            </p>
          )}

          {count > 0 && (
            <ul className="alert-list">
              {state!.alerts.map((a) => (
                <li key={a.id}>
                  <span>
                    {a.kind === "price" ? "Price" : "Score"} {a.direction}{" "}
                    <strong className="mono">
                      {a.kind === "price" ? `$${a.threshold.toFixed(2)}` : a.threshold}
                    </strong>
                  </span>
                  <button type="button" onClick={() => void remove(a.id)} aria-label="Remove alert">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {state && (
            <p className="act-menu-foot dim">
              {state.used} of {state.limit} alerts used.{" "}
              {state.used >= state.limit && <Link href="/pricing">Get more →</Link>}
            </p>
          )}
        </div>
      )}

      {gate && (
        <SignupGate
          title={`Get told when ${symbol} moves`}
          body="A free account sets price and score alerts, so you find out from us rather than from the chart three days later."
          onClose={() => setGate(false)}
        />
      )}
    </div>
  );
}
