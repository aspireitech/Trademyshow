"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const refCode = params.get("ref") ?? undefined;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await apiFetch(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(
        mode === "register" ? { email, name, password, ref: refCode } : { email, password },
      ),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 400, margin: "0 auto 60px" }}>
      <h3>{mode === "login" ? "Welcome back" : "Create your account"}</h3>
      {mode === "register" && (
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
      )}
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
      <div className="field">
        <label htmlFor="password">Password {mode === "register" && <span className="dim">(min 10 chars, mixed case, a number or symbol)</span>}</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 10 : undefined}
        />
      </div>
      <button className="btn" disabled={busy} style={{ width: "100%" }}>
        {busy ? "…" : mode === "login" ? "Log in" : "Sign up free"}
      </button>
      {error && <p className="error">{error}</p>}
      {mode === "login" && (
        <p style={{ marginTop: 14, fontSize: 13 }}>
          <Link href="/reset-password" className="dim">
            Forgot your password?
          </Link>
        </p>
      )}
    </form>
  );
}
