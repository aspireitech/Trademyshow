"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/apiClient";

/**
 * Both halves of the reset flow live here because they are two steps of one
 * job: the token in the URL decides which half you see. Splitting them across
 * two routes would mean two near-identical pages and one more thing to keep
 * in sync.
 */
export default function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  return token ? <SetNewPassword token={token} /> : <RequestLink />;
}

function RequestLink() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await apiPost("/api/auth/password/request", { email });
    setBusy(false);
    // Always the same confirmation: the server will not say whether the
    // address exists, and neither should the screen.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card" style={shell}>
        <h3>Check your inbox</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          If <strong>{email}</strong> has an account, a reset link is on its way. The link works
          once and expires in an hour.
        </p>
        <p style={{ marginTop: 14, fontSize: 14 }}>
          <Link href="/login">Back to log in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={shell}>
      <h3>Reset your password</h3>
      <p className="dim" style={{ fontSize: 14, marginBottom: 14 }}>
        Enter the address you signed up with and we&apos;ll send you a link.
      </p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <button className="btn" disabled={busy} style={{ width: "100%" }}>
        {busy ? "…" : "Send reset link"}
      </button>
      <p style={{ marginTop: 14, fontSize: 13 }}>
        <Link href="/login" className="dim">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

function SetNewPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    setProblems([]);
    const { ok, data } = await apiPost<{ error?: string; problems?: string[] }>(
      "/api/auth/password/reset",
      { token, password },
    );
    setBusy(false);
    if (!ok) {
      setProblems(data.problems ?? []);
      setError(data.problems?.length ? null : (data.error ?? "Could not reset your password."));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="card" style={shell}>
        <h3>Password changed</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          Every other device that was signed in has been signed out, in case one of them was the
          reason you needed this.
        </p>
        <p style={{ marginTop: 14 }}>
          <Link className="btn" href="/login">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card" style={shell}>
      <h3>Choose a new password</h3>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={10}
        />
      </div>
      <div className="field">
        <label htmlFor="confirm">Confirm password</label>
        <input
          id="confirm"
          type="password"
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      <button className="btn" disabled={busy} style={{ width: "100%" }}>
        {busy ? "…" : "Set new password"}
      </button>
      {problems.length > 0 && (
        <ul className="error" style={{ paddingLeft: 18, marginTop: 10 }}>
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
}

const shell: React.CSSProperties = { maxWidth: 420, margin: "60px auto" };
