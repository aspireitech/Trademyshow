"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface GroupSummary {
  id: number;
  name: string;
  holdingsCount: number;
  totalValue: number;
  changePct: number;
}

export default function GroupsPanel() {
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) {
      const data = (await res.json()) as { groups: GroupSummary[] };
      setGroups(data.groups);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create group");
      return;
    }
    setName("");
    await load();
  }

  return (
    <div>
      <h2 style={{ marginBottom: 18 }}>Your watchlists</h2>

      <form onSubmit={createGroup} style={{ display: "flex", gap: 10, marginBottom: 22, maxWidth: 460 }}>
        <input
          className="input"
          placeholder='New watchlist name, e.g. "AI & Chips"'
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="btn">Create</button>
      </form>
      {error && <p className="error" style={{ marginBottom: 16 }}>{error}</p>}

      {groups === null ? (
        <p className="dim">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="card">
          <h3>Create your first watchlist</h3>
          <p className="dim">
            A watchlist is a set of stocks you care about — your holdings, or a theme you are
            following. Once it has stocks, you get a daily insight explaining every move.
          </p>
        </div>
      ) : (
        <div className="grid cols-3">
          {groups.map((g) => (
            <Link key={g.id} href={`/dashboard/groups/${g.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="card">
                <h3>{g.name}</h3>
                <p className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                  ${g.totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </p>
                <p>
                  <span className={g.changePct >= 0 ? "gain" : "loss"}>
                    {g.changePct >= 0 ? "+" : ""}
                    {g.changePct.toFixed(2)}% today
                  </span>{" "}
                  <span className="dim">· {g.holdingsCount} stocks</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
