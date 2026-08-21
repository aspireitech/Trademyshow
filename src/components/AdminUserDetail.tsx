"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface Detail {
  user: {
    id: number; email: string; name: string; plan: string; role: string; createdAt: string;
    emailVerifiedAt: string | null; totpEnabledAt: string | null; phoneVerifiedAt: string | null;
    emailOptIn: boolean; referralCode: string | null;
    termsVersion: string | null; termsAcceptedAt: string | null;
  };
  subscription: { plan: string; paused: boolean; pausedUntil: string | null; daysRemaining: number };
  groups: { id: number; name: string; holdings: string[]; createdAt: string }[];
  counts: { insights: number; alerts: number; sessions: number; referrals: number };
  activity: { id: number; label: string; detail: string | null; createdAt: string; notable: boolean; kind: string }[];
}

export default function AdminUserDetail({ id }: { id: number }) {
  const [d, setD] = useState<Detail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    void apiFetch(`/api/admin/users/${id}`).then(async (r) => {
      if (r.status === 404) { setMissing(true); return; }
      if (r.ok) setD((await r.json()) as Detail);
    });
  }, [id]);

  if (missing) return <p>No such account. <Link href="/dashboard/admin/users">Back to subscribers</Link></p>;
  if (!d) return <p className="dim">Loading…</p>;

  const yes = (v: string | null) => (v ? <span className="badge pro">yes</span> : <span className="badge">no</span>);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p><Link href="/dashboard/admin/users" className="dim">← All subscribers</Link></p>

      <section className="card">
        <div className="sec-head">
          <h3 style={{ margin: 0 }}>{d.user.name}</h3>
          <span className={`badge ${d.user.plan !== "free" ? "pro" : ""}`}>{d.user.plan}</span>
        </div>
        <dl className="settings-list">
          <div><dt>Email</dt><dd>{d.user.email}</dd></div>
          <div><dt>Account ID</dt><dd className="mono">{d.user.id}</dd></div>
          <div><dt>Role</dt><dd>{d.user.role}</dd></div>
          <div><dt>Joined</dt><dd className="dim">{new Date(d.user.createdAt).toLocaleString()}</dd></div>
          <div><dt>Email verified</dt><dd>{yes(d.user.emailVerifiedAt)}</dd></div>
          <div><dt>Two-factor</dt><dd>{yes(d.user.totpEnabledAt)}</dd></div>
          <div><dt>Mobile verified</dt><dd>{yes(d.user.phoneVerifiedAt)}</dd></div>
          <div><dt>Insight emails</dt><dd>{d.user.emailOptIn ? "on" : "off"}</dd></div>
          <div><dt>Referral code</dt><dd className="mono">{d.user.referralCode ?? "—"}</dd></div>
          <div>
            <dt>Terms accepted</dt>
            <dd className="dim">
              {d.user.termsAcceptedAt
                ? `${d.user.termsVersion} on ${new Date(d.user.termsAcceptedAt).toLocaleDateString()}`
                : "no record"}
            </dd>
          </div>
          {d.subscription.paused && (
            <div>
              <dt>Subscription</dt>
              <dd><span className="badge warn">paused</span> {d.subscription.daysRemaining} days left</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card">
        <h3>Usage</h3>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div className="stat"><strong>{d.groups.length}</strong><span className="dim">watchlists</span></div>
          <div className="stat"><strong>{d.counts.insights}</strong><span className="dim">insights</span></div>
          <div className="stat"><strong>{d.counts.alerts}</strong><span className="dim">alerts</span></div>
          <div className="stat"><strong>{d.counts.sessions}</strong><span className="dim">active devices</span></div>
          <div className="stat"><strong>{d.counts.referrals}</strong><span className="dim">referrals</span></div>
        </div>

        {d.groups.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="holdings">
              <thead><tr><th>Watchlist</th><th>Holdings</th><th>Created</th></tr></thead>
              <tbody>
                {d.groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td className="mono dim" style={{ fontSize: 12 }}>{g.holdings.join(", ") || "empty"}</td>
                    <td className="dim mono" style={{ fontSize: 12 }}>
                      {new Date(g.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Recent activity</h3>
        <ol className="activity-feed">
          {d.activity.map((e) => (
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
        <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          Opening this page is itself recorded against your admin account.
        </p>
      </section>
    </div>
  );
}
