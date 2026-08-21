"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";

export default function ProfileSection({
  name, email, plan, emailVerified, createdAt,
}: {
  name: string; email: string; plan: string; emailVerified: boolean; createdAt: string;
}) {
  const [sent, setSent] = useState(false);
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch("/api/account/preferences")
      .then((r) => (r.ok ? r.json() : { emailOptIn: false }))
      .then((d: { emailOptIn: boolean }) => setOptIn(d.emailOptIn));
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    const { ok } = await apiPost("/api/account/preferences", { emailOptIn: next });
    if (ok) setOptIn(next);
    setBusy(false);
  }

  return (
    <>
      <section className="card">
        <h3>Account</h3>
        <dl className="settings-list">
          <div><dt>Name</dt><dd>{name}</dd></div>
          <div>
            <dt>Email</dt>
            <dd>
              {email}{" "}
              {emailVerified
                ? <span className="badge pro">verified</span>
                : <span className="badge warn">unverified</span>}
            </dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>
              <span className={`badge ${plan !== "free" ? "pro" : ""}`}>{plan}</span>{" "}
              <Link href="/dashboard/settings/billing" className="dim" style={{ fontSize: 13 }}>
                Manage plan
              </Link>
            </dd>
          </div>
          <div><dt>Member since</dt><dd className="dim">{new Date(createdAt).toLocaleDateString()}</dd></div>
        </dl>

        {!emailVerified && (
          <div className="callout" style={{ marginTop: 14 }}>
            <strong>Confirm your email to get insights delivered.</strong>{" "}
            <span className="dim">
              We only send to confirmed addresses — it is what keeps our mail out of spam folders.
            </span>
            <div style={{ marginTop: 10 }}>
              {sent ? (
                <span className="dim" style={{ fontSize: 13 }}>
                  Sent. Check your inbox, then <Link href="/verify-email">enter the code</Link>.
                </span>
              ) : (
                <button
                  className="btn small"
                  onClick={async () => { await apiPost("/api/auth/verify/send"); setSent(true); }}
                >
                  Send confirmation email
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Insight emails</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          One email a morning covering your largest watchlist, plus the weekly wrap. Never more
          than one a day.
        </p>
        {optIn === null ? (
          <p className="dim" style={{ marginTop: 12 }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              className={`btn small ${optIn ? "" : "secondary"}`}
              disabled={busy}
              onClick={() => toggle(!optIn)}
            >
              {optIn ? "Emails on — turn off" : "Emails off — turn on"}
            </button>
            <span className="dim" style={{ fontSize: 13 }}>
              {optIn ? "You are receiving insight emails." : "You are not receiving any emails."}
            </span>
          </div>
        )}
      </section>
    </>
  );
}
