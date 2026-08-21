"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";
import type { UserSession } from "@/lib/types";

export default function SecuritySection() {
  return (
    <>
      <TwoFactor />
      <PhoneVerification />
      <SecurityQuestions />
      <Devices />
    </>
  );
}

// ---------- authenticator app ----------

function TwoFactor() {
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
  useEffect(() => { void refresh(); }, [refresh]);

  async function begin() {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ secret: string; otpauthUrl: string }>("/api/account/2fa", { action: "begin" });
    setBusy(false);
    if (ok) { setSecret(data.secret); setUri(data.otpauthUrl); }
  }

  async function finish(action: "enable" | "disable") {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ error?: string; recoveryCodes?: string[] }>("/api/account/2fa", { action, code });
    setBusy(false);
    if (!ok) { setError(data.error ?? "That did not work."); return; }
    setCode(""); setSecret(null); setUri(null);
    if (data.recoveryCodes) setRecovery(data.recoveryCodes);
    await refresh();
  }

  return (
    <section className="card">
      <div className="sec-head">
        <h3>Authenticator app</h3>
        <span className={`badge ${enabled ? "pro" : "warn"}`}>{enabled === null ? "…" : enabled ? "on" : "off"}</span>
      </div>
      <p className="dim" style={{ fontSize: 14 }}>
        A six-digit code from an app on your phone, on top of your password.{" "}
        <strong>The strongest option here</strong> — it works offline and cannot be intercepted.
      </p>

      {recovery && (
        <div className="callout" style={{ marginTop: 14 }}>
          <strong>Save your recovery codes now.</strong>
          <p className="dim" style={{ fontSize: 13, margin: "6px 0 10px" }}>
            Each works once, if you lose your phone. This is the only time they are shown.
          </p>
          <div className="mono recovery-grid">
            {recovery.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>
      )}

      {enabled === false && !secret && (
        <button className="btn small" style={{ marginTop: 12 }} onClick={begin} disabled={busy}>
          {busy ? "…" : "Set up authenticator"}
        </button>
      )}

      {secret && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 14 }}>Add this key to your authenticator app, then enter the code it shows.</p>
          <p className="mono secret-key">{secret}</p>
          {uri && <p className="dim" style={{ fontSize: 12, wordBreak: "break-all" }}>Or open: {uri}</p>}
          <div className="inline-form">
            <input className="input mono" inputMode="numeric" maxLength={6} placeholder="000000"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="Authenticator code" />
            <button className="btn small" onClick={() => finish("enable")} disabled={busy}>Turn on</button>
          </div>
        </div>
      )}

      {enabled === true && (
        <div className="inline-form" style={{ marginTop: 14 }}>
          <input className="input mono" inputMode="numeric" maxLength={6} placeholder="000000"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label="Current code" />
          <button className="btn small secondary" onClick={() => finish("disable")} disabled={busy}>
            Turn authenticator off
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------- mobile number ----------

function PhoneVerification() {
  const [phone, setPhone] = useState("");
  const [stored, setStored] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiFetch("/api/account/phone");
    if (!res.ok) return;
    const d = (await res.json()) as { phone: string | null; verified: boolean };
    setStored(d.phone); setVerified(d.verified);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function send() {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ error?: string; devCode?: string }>("/api/account/phone", { action: "send", phone });
    setBusy(false);
    if (!ok) { setError(data.error ?? "Could not send the code."); return; }
    setStage("sent");
    setDevCode(data.devCode ?? null);
  }

  async function verify() {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/account/phone", { action: "verify", code });
    setBusy(false);
    if (!ok) { setError(data.error ?? "That code is not correct."); return; }
    setStage("idle"); setCode(""); setDevCode(null);
    await refresh();
  }

  async function remove() {
    await apiFetch("/api/account/phone", { method: "DELETE" });
    setStored(null); setVerified(false);
  }

  return (
    <section className="card">
      <div className="sec-head">
        <h3>Mobile number</h3>
        <span className={`badge ${verified ? "pro" : ""}`}>{verified ? "verified" : "not set"}</span>
      </div>
      <p className="dim" style={{ fontSize: 14 }}>
        Used for account recovery codes by SMS.{" "}
        <strong>Weaker than an authenticator app</strong> — a stolen or swapped SIM defeats it — so
        treat it as a backup way in, not your main protection.
      </p>

      {verified && stored ? (
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono">{stored}</span>
          <button className="btn small secondary" onClick={remove}>Remove</button>
        </div>
      ) : stage === "idle" ? (
        <div className="inline-form" style={{ marginTop: 12 }}>
          <input className="input" style={{ maxWidth: 210 }} placeholder="+14155550123"
            value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Mobile number" />
          <button className="btn small" onClick={send} disabled={busy || phone.length < 8}>
            {busy ? "…" : "Send code"}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {devCode && (
            <p className="callout" style={{ fontSize: 13 }}>
              Sandbox: no SMS is sent. Your code is <strong className="mono">{devCode}</strong>.
            </p>
          )}
          <div className="inline-form">
            <input className="input mono" style={{ maxWidth: 140 }} inputMode="numeric" maxLength={6}
              placeholder="000000" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="SMS code" />
            <button className="btn small" onClick={verify} disabled={busy}>Verify</button>
            <button className="btn small secondary" onClick={() => setStage("idle")}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------- security questions ----------

interface Question { id: string; text: string }

function SecurityQuestions() {
  const [bank, setBank] = useState<Question[]>([]);
  const [answered, setAnswered] = useState<Question[]>([]);
  const [required, setRequired] = useState(3);
  const [editing, setEditing] = useState(false);
  const [picks, setPicks] = useState<{ questionId: string; answer: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await apiFetch("/api/account/security-questions");
    if (!res.ok) return;
    const d = (await res.json()) as { bank: Question[]; answered: Question[]; required: number };
    setBank(d.bank); setAnswered(d.answered); setRequired(d.required);
    setPicks(Array.from({ length: d.required }, (_, i) => ({
      questionId: d.bank[i]?.id ?? "", answer: "",
    })));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function save() {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/account/security-questions", { answers: picks });
    setBusy(false);
    if (!ok) { setError(data.error ?? "Could not save."); return; }
    setEditing(false);
    await refresh();
  }

  // A question already chosen above should not be selectable twice.
  const taken = new Set(picks.map((p) => p.questionId));

  return (
    <section className="card">
      <div className="sec-head">
        <h3>Security questions</h3>
        <span className={`badge ${answered.length ? "pro" : ""}`}>
          {answered.length ? `${answered.length} set` : "not set"}
        </span>
      </div>
      <p className="dim" style={{ fontSize: 14 }}>
        Used by support to confirm it is really you, alongside your email — never on their own, and
        never to sign in. Answers are stored scrambled and cannot be read back by anyone here.
      </p>

      {!editing && answered.length > 0 && (
        <ul className="plain-list">
          {answered.map((q) => <li key={q.id}>{q.text}</li>)}
        </ul>
      )}

      {!editing && (
        <button className="btn small secondary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>
          {answered.length ? "Change questions" : "Set up questions"}
        </button>
      )}

      {editing && (
        <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
          {picks.map((pick, i) => (
            <div key={i} className="field" style={{ margin: 0 }}>
              <label htmlFor={`q-${i}`}>Question {i + 1}</label>
              <select
                id={`q-${i}`}
                className="input"
                value={pick.questionId}
                onChange={(e) => {
                  const next = [...picks];
                  next[i] = { ...next[i], questionId: e.target.value };
                  setPicks(next);
                }}
              >
                {bank
                  .filter((q) => q.id === pick.questionId || !taken.has(q.id))
                  .map((q) => <option key={q.id} value={q.id}>{q.text}</option>)}
              </select>
              <input
                className="input"
                style={{ marginTop: 6 }}
                placeholder="Your answer"
                value={pick.answer}
                onChange={(e) => {
                  const next = [...picks];
                  next[i] = { ...next[i], answer: e.target.value };
                  setPicks(next);
                }}
                aria-label={`Answer ${i + 1}`}
              />
            </div>
          ))}
          <p className="dim" style={{ fontSize: 12 }}>
            Capitals, spacing and punctuation are ignored, so you do not have to remember exactly
            how you typed it. Answer all {required}.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn small" onClick={save} disabled={busy}>{busy ? "…" : "Save answers"}</button>
            <button className="btn small secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

// ---------- devices ----------

function Devices() {
  const [sessions, setSessions] = useState<UserSession[] | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/account/sessions");
    if (res.ok) setSessions(((await res.json()) as { sessions: UserSession[] }).sessions);
  }, []);
  useEffect(() => { void load(); }, [load]);

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
                <tr><th>Device</th><th>First seen</th><th>Last active</th><th /></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.jti}>
                    <td style={{ maxWidth: 280 }}>
                      {describeAgent(s.userAgent)}{" "}
                      {s.current && <span className="badge pro">this device</span>}
                    </td>
                    <td className="dim mono">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="dim mono">{new Date(s.lastSeenAt).toLocaleString()}</td>
                    <td>
                      {!s.current && (
                        <button className="btn small secondary"
                          onClick={() => revoke(`jti=${encodeURIComponent(s.jti)}`)}>
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
            <button className="btn small secondary" style={{ marginTop: 12 }}
              onClick={() => revoke("all=true")}>
              Sign out everywhere else
            </button>
          )}
        </>
      )}
    </section>
  );
}

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}
