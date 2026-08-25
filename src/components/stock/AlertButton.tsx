"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, apiPost } from "@/lib/apiClient";
import SignupGate from "./SignupGate";

/**
 * Price, daily-move and score alerts for one symbol.
 *
 * Three kinds because they answer different questions. "Tell me if it drops
 * below $15" is a limit price the visitor already has in mind. "Tell me if
 * it moves 5% today" doesn't need a price target, just volatility. "Tell me
 * when the signals turn" is what this product measures and nobody else
 * publishes. The limit-price alert is the one people ask for first, and it
 * is the reason they come back.
 */

type AlertKind = "price" | "score" | "change";

interface AlertRow {
  id: number;
  kind: AlertKind;
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
  const [kind, setKind] = useState<AlertKind>("price");
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
    else if (kind === "change") setValue("5");
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
              <button type="button" className={kind === "change" ? "on" : ""}
                onClick={() => setKind("change")}>daily move</button>
              <button type="button" className={kind === "score" ? "on" : ""}
                onClick={() => setKind("score")}>Insight Score</button>
            </div>
            <div className="seg" role="group" aria-label="Direction">
              <button type="button" className={direction === "above" ? "on" : ""}
                onClick={() => setDirection("above")}>
                {kind === "change" ? "up more than" : "goes above"}
              </button>
              <button type="button" className={direction === "below" ? "on" : ""}
                onClick={() => setDirection("below")}>
                {kind === "change" ? "down more than" : "drops below"}
              </button>
            </div>
            <div className="alert-value">
              <span className="dim">{kind === "price" ? "$" : kind === "score" ? "score" : "%"}</span>
              <input
                className="input"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={
                  kind === "price" ? "Price threshold" : kind === "change" ? "Daily move threshold" : "Score threshold"
                }
              />
              <button type="submit" className="btn small" disabled={busy}>Set alert</button>
            </div>
          </form>
          {kind === "change" && (
            <p className="act-note dim" style={{ marginTop: 6 }}>
              A limit alert on the day&apos;s move — fires once {symbol} is {direction === "above" ? "up" : "down"}{" "}
              {value || "5"}% or more since yesterday&apos;s close, whichever side of zero you picked above.
            </p>
          )}

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
                    {a.kind === "price" && (
                      <>
                        Price {a.direction} <strong className="mono">${a.threshold.toFixed(2)}</strong>
                      </>
                    )}
                    {a.kind === "change" && (
                      <>
                        Day&apos;s move {a.direction === "above" ? "up" : "down"}{" "}
                        <strong className="mono">{a.threshold}%</strong> or more
                      </>
                    )}
                    {a.kind === "score" && (
                      <>
                        Score {a.direction} <strong className="mono">{a.threshold}</strong>
                      </>
                    )}
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
