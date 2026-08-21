"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface Row {
  id: number; email: string; name: string; plan: string; role: string;
  trialEndsAt: string | null; pausedUntil: string | null;
  emailVerified: boolean; twoFactor: boolean; createdAt: string;
}
interface Payload {
  users: Row[]; total: number;
  counts: { all_users: number; free: number; pro: number; premium: number; trialing: number; paused: number };
}

const TIERS = [
  { key: "", label: "All", countKey: "all_users" },
  { key: "premium", label: "Premium", countKey: "premium" },
  { key: "pro", label: "Pro", countKey: "pro" },
  { key: "trialing", label: "On trial", countKey: "trialing" },
  { key: "free", label: "Free", countKey: "free" },
  { key: "paused", label: "Paused", countKey: "paused" },
] as const;

export default function AdminUsers() {
  const [data, setData] = useState<Payload | null>(null);
  const [plan, setPlan] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (plan) q.set("plan", plan);
    if (query.trim()) q.set("q", query.trim());
    const res = await apiFetch(`/api/admin/users?${q}`);
    if (res.ok) setData((await res.json()) as Payload);
  }, [plan, query, limit]);

  // Debounced so typing a name does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <section className="card">
      <div className="sec-head">
        <h3>Subscribers</h3>
        <span className="dim" style={{ fontSize: 13 }}>
          {data ? `${data.total} matching` : "…"}
        </span>
      </div>

      <div className="tf-tabs" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {TIERS.map((t) => (
          <button key={t.key} className={plan === t.key ? "active" : ""} onClick={() => setPlan(t.key)}>
            {t.label}
            {data && <span className="dim"> {data.counts[t.countKey] ?? 0}</span>}
          </button>
        ))}
      </div>

      <input
        className="input"
        style={{ marginTop: 12, maxWidth: 340 }}
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search subscribers"
      />

      {!data ? (
        <p className="dim" style={{ marginTop: 14 }}>Loading…</p>
      ) : data.users.length === 0 ? (
        <p className="dim" style={{ marginTop: 14, fontSize: 14 }}>No accounts match that.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Account</th><th>Plan</th><th>Security</th><th>Joined</th><th />
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const paused = u.pausedUntil && new Date(u.pausedUntil) > new Date();
                  const trialing = u.plan === "free" && u.trialEndsAt && new Date(u.trialEndsAt) > new Date();
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <br />
                        <span className="dim" style={{ fontSize: 12 }}>{u.email}</span>
                      </td>
                      <td>
                        <span className={`badge ${u.plan !== "free" ? "pro" : ""}`}>{u.plan}</span>
                        {trialing && <span className="badge" style={{ marginLeft: 4 }}>trial</span>}
                        {paused && <span className="badge warn" style={{ marginLeft: 4 }}>paused</span>}
                      </td>
                      <td style={{ fontSize: 12 }} className="dim">
                        {u.emailVerified ? "email ✓" : "email ✗"}
                        <br />
                        {u.twoFactor ? "2FA ✓" : "2FA ✗"}
                      </td>
                      <td className="dim mono" style={{ fontSize: 12 }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <Link className="btn small secondary" href={`/dashboard/admin/users/${u.id}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.users.length >= limit && limit < data.total && (
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
