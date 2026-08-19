"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/apiClient";

type State = "idle" | "checking" | "done" | "failed";

/**
 * Two ways in: the emailed link (token in the URL, confirmed automatically) or
 * the six-digit code typed by hand. The code path exists because link
 * rewriting in corporate mail gateways breaks tokens often enough to matter.
 */
export default function VerifyEmailPanel() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<State>(token ? "checking" : "idle");
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const { ok, data } = await apiPost<{ error?: string }>("/api/auth/verify/confirm", { token });
      setState(ok ? "done" : "failed");
      if (!ok) setMessage(data.error ?? "That link is no longer valid.");
    })();
  }, [token]);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setState("checking");
    const { ok, data } = await apiPost<{ error?: string }>("/api/auth/verify/confirm", { code });
    setState(ok ? "done" : "failed");
    if (!ok) setMessage(data.error ?? "That code is not valid.");
  }

  async function resend() {
    await apiPost("/api/auth/verify/send");
    setResent(true);
  }

  if (state === "done") {
    return (
      <div className="card" style={shell}>
        <h3>Email confirmed</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          Your daily and weekly insights will now arrive in your inbox. You can change the cadence
          or switch them off any time in settings.
        </p>
        <p style={{ marginTop: 14 }}>
          <Link className="btn" href="/dashboard">
            Go to dashboard
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={shell}>
      <h3>Confirm your email</h3>
      <p className="dim" style={{ fontSize: 14, marginBottom: 14 }}>
        {state === "checking" && token
          ? "Checking your link…"
          : "Enter the six-digit code from the email we sent you."}
      </p>

      <form onSubmit={submitCode}>
        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            className="input mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
        <button className="btn" disabled={state === "checking"} style={{ width: "100%" }}>
          {state === "checking" ? "…" : "Confirm email"}
        </button>
      </form>

      {state === "failed" && message && <p className="error">{message}</p>}

      <p style={{ marginTop: 16, fontSize: 13 }} className="dim">
        {resent ? (
          "Sent — check your inbox."
        ) : (
          <>
            Didn&apos;t get it?{" "}
            <button className="btn small secondary" onClick={resend} type="button">
              Send it again
            </button>
          </>
        )}
      </p>
    </div>
  );
}

const shell: React.CSSProperties = { maxWidth: 420, margin: "60px auto" };
