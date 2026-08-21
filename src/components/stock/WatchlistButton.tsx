"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/apiClient";
import SignupGate from "./SignupGate";

/**
 * "Add to watchlist", with the two paths it actually has.
 *
 * Signed out, it asks for an account — at the point of wanting, not at the
 * door. Signed in, it offers the lists that already exist and the option of a
 * new one, because forcing everything into a single list is how a watchlist
 * stops being useful at about the twentieth holding.
 */

interface WatchlistState {
  signedIn: boolean;
  lists: { id: number; name: string; count: number; full: boolean; contains: boolean }[];
  canCreate?: boolean;
  maxPerList?: number;
}

export default function WatchlistButton({ symbol }: { symbol: string }) {
  const [state, setState] = useState<WatchlistState | null>(null);
  const [open, setOpen] = useState(false);
  const [gate, setGate] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return;
    setState((await res.json()) as WatchlistState);
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  const alreadyIn = state?.lists.filter((l) => l.contains) ?? [];

  async function add(listId?: number, name?: string) {
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ error?: string; listName?: string; upgrade?: boolean }>(
      "/api/watchlist",
      { symbol, listId, newListName: name },
    );
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Could not add that just now.");
      return;
    }
    setDone(data.listName ?? "your watchlist");
    setNewName("");
    setOpen(false);
    void load();
  }

  function onClick() {
    if (!state) return;
    if (!state.signedIn) {
      setGate(true);
      return;
    }
    // One list and the stock is not in it: the menu would offer a single
    // choice, so skip it and just add.
    if (state.lists.length <= 1 && alreadyIn.length === 0) {
      void add(state.lists[0]?.id);
      return;
    }
    setOpen((o) => !o);
  }

  return (
    <div className="act-wrap">
      <button
        type="button"
        className={`act-btn${alreadyIn.length > 0 ? " on" : ""}`}
        onClick={onClick}
        disabled={busy || !state}
        aria-haspopup={state?.signedIn ? "menu" : undefined}
        aria-expanded={open}
      >
        <span aria-hidden="true">{alreadyIn.length > 0 ? "★" : "＋"}</span>
        {alreadyIn.length > 0 ? "On watchlist" : "Watchlist"}
      </button>

      {done && (
        <p className="act-note gain" role="status">
          Added to <strong>{done}</strong>. <Link href="/dashboard">Open dashboard →</Link>
        </p>
      )}
      {error && (
        <p className="act-note loss" role="alert">
          {error} {error.includes("Upgrade") && <Link href="/pricing">See plans →</Link>}
        </p>
      )}

      {open && state?.signedIn && (
        <div className="act-menu" role="menu">
          <p className="act-menu-title">Add {symbol} to</p>
          {state.lists.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitem"
              disabled={l.contains || busy}
              onClick={() => void add(l.id)}
            >
              <span>{l.name}</span>
              <span className="dim">
                {l.contains ? "already there" : `${l.count}${l.full ? " · full" : ""}`}
              </span>
            </button>
          ))}

          {state.canCreate ? (
            <form
              className="act-menu-new"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) void add(undefined, newName.trim());
              }}
            >
              <input
                className="input"
                placeholder="New watchlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="New watchlist name"
              />
              <button type="submit" className="btn small" disabled={!newName.trim() || busy}>
                Create
              </button>
            </form>
          ) : (
            <p className="act-menu-foot dim">
              Your plan keeps {state.lists.length} watchlist
              {state.lists.length === 1 ? "" : "s"}. <Link href="/pricing">More →</Link>
            </p>
          )}
        </div>
      )}

      {gate && (
        <SignupGate
          title="Keep this stock on a watchlist"
          body={`A free account saves ${symbol} to a watchlist and reads it back to you each market day — what moved, by how much, and why.`}
          onClose={() => setGate(false)}
        />
      )}
    </div>
  );
}
