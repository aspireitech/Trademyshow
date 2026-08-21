"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface Entry {
  id: number; action: string; label: string;
  kind: "security" | "billing" | "account" | "data";
  notable: boolean; detail: string | null; createdAt: string;
}

const FILTERS = [
  { key: "", label: "Everything" },
  { key: "security", label: "Security" },
  { key: "billing", label: "Billing" },
  { key: "account", label: "Account" },
  { key: "data", label: "Data" },
] as const;

/**
 * The account's own history. Entries worth a second look are marked rather
 * than merely listed — the value of showing someone their security history is
 * that they spot the line they did not cause.
 */
export default function ActivitySection() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [kind, setKind] = useState("");
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (kind) q.set("kind", kind);
    const res = await apiFetch(`/api/account/activity?${q}`);
    if (!res.ok) return;
    const d = (await res.json()) as { entries: Entry[]; total: number };
    setEntries(d.entries); setTotal(d.total);
  }, [kind, limit]);
  useEffect(() => { void load(); }, [load]);

  return (
    <section className="card">
      <div className="sec-head">
        <h3>Account activity</h3>
        <span className="dim" style={{ fontSize: 13 }}>{total} recorded</span>
      </div>
      <p className="dim" style={{ fontSize: 14 }}>
        Every change to this account, with the most recent first. If you see something here you did
        not do, change your password and sign out your other devices.
      </p>

      <div className="tf-tabs" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={kind === f.key ? "active" : ""} onClick={() => setKind(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {entries === null ? (
        <p className="dim" style={{ marginTop: 14 }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="dim" style={{ marginTop: 14, fontSize: 14 }}>Nothing recorded in this category yet.</p>
      ) : (
        <>
          <ol className="activity-feed">
            {entries.map((e) => (
              <li key={e.id} className={e.notable ? "notable" : ""}>
                <span className={`activity-dot kind-${e.kind}`} aria-hidden="true" />
                <span className="activity-body">
                  <span className="activity-label">{e.label}</span>
                  {e.detail && <span className="dim activity-detail">{e.detail}</span>}
                </span>
                <time className="dim mono activity-time" dateTime={e.createdAt}>
                  {new Date(e.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
          {entries.length >= limit && limit < total && (
            <button className="btn small secondary" style={{ marginTop: 14 }}
              onClick={() => setLimit((n) => n + 50)}>
              Show more
            </button>
          )}
        </>
      )}
    </section>
  );
}
