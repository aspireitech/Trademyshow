"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";
import type { UserSession } from "@/lib/types";

interface Props {
  name: string;
  email: string;
  plan: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function SettingsPanel(props: Props) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <AccountSection {...props} />
      <EmailSection />
      <TwoFactorSection />
      <SessionsSection />
      <ReferralSection />
      <DataSection />
    </div>
  );
}

// ---------- account ----------

function AccountSection({ name, email, plan, emailVerified, createdAt }: Props) {
  const [sent, setSent] = useState(false);

  return (
    <section className="card">
      <h3>Account</h3>
      <dl className="settings-list">
        <div>
          <dt>Name</dt>
          <dd>{name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>
            {email}{" "}
            {emailVerified ? (
              <span className="badge pro">verified</span>
            ) : (
              <span className="badge">unverified</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>
            <span className={`badge ${plan !== "free" ? "pro" : ""}`}>{plan}</span>{" "}
            <Link href="/pricing" className="dim" style={{ fontSize: 13 }}>
              Compare plans
            </Link>
          </dd>
        </div>
        <div>
          <dt>Member since</dt>
          <dd className="dim">{new Date(createdAt).toLocaleDateString()}</dd>
        </div>
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
                Sent. Check your inbox, then{" "}
                <Link href="/verify-email">enter the code</Link>.
              </span>
            ) : (
              <button
                className="btn small"
                onClick={async () => {
                  await apiPost("/api/auth/verify/send");
                  setSent(true);
                }}
              >
                Send confirmation email
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- email preferences ----------

function EmailSection() {
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
    <section className="card">
      <h3>Insight emails</h3>
      <p className="dim" style={{ fontSize: 14 }}>
        One email a morning covering your largest watchlist, plus the weekly wrap. Never more than
        one a day.
      </p>
      {optIn === null ? (
        <p className="dim" style={{ marginTop: 12 }}>
          Loading…
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
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
  );
}

// ---------- two-factor ----------

function TwoFactorSection() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiFetch("/api/account/2fa");
    if (res.ok) setEnabled(((await res.json()) as { enabled: boolean }).enabled);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function begin() {
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ secret: string; otpauthUrl: string }>(
      "/api/account/2fa",
      { action: "begin" },
    );
    setBusy(false);
    if (ok) {
      setSecret(data.secret);
      setUri(data.otpauthUrl);
    }
  }

  async function finish(action: "enable" | "disable") {
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ error?: string; recoveryCodes?: string[] }>(
      "/api/account/2fa",
      { action, code },
    );
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "That did not work.");
      return;
    }
    setCode("");
    setSecret(null);
    setUri(null);
    if (data.recoveryCodes) setRecovery(data.recoveryCodes);
    await refresh();
  }

  return (
    <section className="card">
      <h3>
        Two-factor authentication{" "}
        {enabled && <span className="badge pro" style={{ fontSize: 11 }}>on</span>}
      </h3>
      <p className="dim" style={{ fontSize: 14 }}>
        A six-digit code from your authenticator app, on top of your password. Your watchlists say
        a lot about your money — this is worth the thirty seconds.
      </p>

      {recovery && (
        <div className="callout" style={{ marginTop: 14 }}>
          <strong>Save your recovery codes now.</strong>
          <p className="dim" style={{ fontSize: 13, margin: "6px 0 10px" }}>
            Each one works once, if you lose your phone. This is the only time they are shown.
          </p>
          <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 6, fontSize: 13 }}>
            {recovery.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {enabled === null && <p className="dim" style={{ marginTop: 12 }}>Loading…</p>}

      {enabled === false && !secret && (
        <button className="btn small" style={{ marginTop: 12 }} onClick={begin} disabled={busy}>
          {busy ? "…" : "Set up two-factor"}
        </button>
      )}

      {secret && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 14 }}>
            Add this key to your authenticator app, then enter the code it shows.
          </p>
          <p className="mono" style={{ margin: "8px 0", wordBreak: "break-all", fontSize: 14 }}>
            {secret}
          </p>
          {uri && (
            <p className="dim" style={{ fontSize: 12, wordBreak: "break-all" }}>
              Or open: {uri}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              className="input mono"
              style={{ maxWidth: 140 }}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="Authenticator code"
            />
            <button className="btn small" onClick={() => finish("enable")} disabled={busy}>
              Turn on
            </button>
          </div>
        </div>
      )}

      {enabled === true && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <input
            className="input mono"
            style={{ maxWidth: 140 }}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Current code"
          />
          <button className="btn small secondary" onClick={() => finish("disable")} disabled={busy}>
            Turn two-factor off
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------- sessions ----------

function SessionsSection() {
  const [sessions, setSessions] = useState<UserSession[] | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/account/sessions");
    if (res.ok) setSessions(((await res.json()) as { sessions: UserSession[] }).sessions);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(query: string) {
    await apiFetch(`/api/account/sessions?${query}`, { method: "DELETE" });
    await load();
  }

  return (
    <section className="card">
      <h3>Signed-in devices</h3>
      <p className="dim" style={{ fontSize: 14 }}>
        Anything here can read your account. If you do not recognise one, sign it out.
      </p>
      {sessions === null ? (
        <p className="dim" style={{ marginTop: 12 }}>Loading…</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>First seen</th>
                  <th>Last active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.jti}>
                    <td style={{ maxWidth: 300 }}>
                      {describeAgent(s.userAgent)}{" "}
                      {s.current && <span className="badge pro" style={{ fontSize: 11 }}>this device</span>}
                    </td>
                    <td className="dim mono">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="dim mono">{new Date(s.lastSeenAt).toLocaleString()}</td>
                    <td>
                      {!s.current && (
                        <button
                          className="btn small secondary"
                          onClick={() => revoke(`jti=${encodeURIComponent(s.jti)}`)}
                        >
                          Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sessions.length > 1 && (
            <button
              className="btn small secondary"
              style={{ marginTop: 12 }}
              onClick={() => revoke("all=true")}
            >
              Sign out everywhere else
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Turn a user-agent string into something a human can recognise. */
function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

// ---------- referrals ----------

interface ReferralData {
  code: string | null;
  pending: number;
  converted: number;
  earnedCents: number;
  commissionPct: number;
  shareUrl: string | null;
}

function ReferralSection() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void apiFetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ReferralData | null) => setData(d));
  }, []);

  if (!data) {
    return (
      <section className="card">
        <h3>Refer a friend</h3>
        <p className="dim" style={{ fontSize: 14 }}>Loading…</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Refer a friend</h3>
      <p className="dim" style={{ fontSize: 14 }}>
        Share your link. When someone you refer subscribes, you earn{" "}
        <strong>{data.commissionPct}%</strong> of what they pay, for as long as they stay.
      </p>

      {data.shareUrl && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input className="input mono" readOnly value={data.shareUrl} style={{ flex: "1 1 260px", fontSize: 13 }} />
          <button
            className="btn small"
            onClick={() => {
              void navigator.clipboard?.writeText(data.shareUrl!).then(() => setCopied(true));
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <strong>{data.pending}</strong>
          <span className="dim">signed up</span>
        </div>
        <div className="stat good">
          <strong>{data.converted}</strong>
          <span className="dim">subscribed</span>
        </div>
        <div className="stat good">
          <strong>${(data.earnedCents / 100).toFixed(2)}</strong>
          <span className="dim">earned</span>
        </div>
      </div>
    </section>
  );
}

// ---------- data & deletion ----------

function DataSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/account/delete", {
      password,
      confirm,
    });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Could not delete the account.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <section className="card">
      <h3>Your data</h3>
      <p className="dim" style={{ fontSize: 14 }}>
        Download everything we hold about you, or close the account for good.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn small secondary" href="/api/account/export">
          Download my data
        </a>
        <button className="btn small secondary" onClick={() => setOpen((v) => !v)}>
          Delete account
        </button>
      </div>

      {open && (
        <form onSubmit={remove} style={{ marginTop: 16 }}>
          <p className="error" style={{ marginTop: 0 }}>
            This deletes your watchlists, insights and history immediately. It cannot be undone.
          </p>
          <div className="field">
            <label htmlFor="del-password">Your password</label>
            <input
              id="del-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="del-confirm">Type DELETE to confirm</label>
            <input
              id="del-confirm"
              className="input mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <button className="btn small" disabled={busy || confirm !== "DELETE"}>
            {busy ? "…" : "Permanently delete my account"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </section>
  );
}
