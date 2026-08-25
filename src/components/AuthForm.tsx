"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { TERMS_VERSION } from "@/lib/legal";
import { TRIAL_DAYS } from "@/lib/plans";

const PLAN_NAMES: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };

export interface AuthProvider {
  id: string;
  label: string;
}

export default function AuthForm({
  mode,
  providers = [],
}: {
  mode: "login" | "register";
  providers?: AuthProvider[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const refCode = params.get("ref") ?? undefined;
  const planParam = params.get("plan");
  const selectedPlan = planParam && PLAN_NAMES[planParam] ? planParam : null;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  // The same tick gates the password form and the social buttons. Two separate
  // consents for one account would be a worse record and a worse experience.
  const socialHref = (id: string) => {
    const q = new URLSearchParams({ terms: TERMS_VERSION });
    if (refCode) q.set("ref", refCode);
    return `/api/auth/oauth/${id}?${q.toString()}`;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (registering && !accepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await apiFetch(`/api/auth/${mode}`, {
      method: "POST",
      body: JSON.stringify(
        registering
          ? { email, name, password, ref: refCode, acceptTerms: true, termsVersion: TERMS_VERSION }
          : { email, password },
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
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <form onSubmit={submit} className="card">
        <h3>{registering ? "Create your account" : "Welcome back"}</h3>

        {/* Every account gets the same trial regardless of which pricing
            card sent them here — there is no separate signup path per plan.
            This just confirms the choice honestly instead of pretending the
            picked plan is already active. */}
        {registering && selectedPlan && (
          <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>
            {selectedPlan === "premium"
              ? `You picked Premium. Every account starts with a ${TRIAL_DAYS}-day Pro trial first — no card needed — and you can upgrade to Premium from billing whenever you're ready.`
              : selectedPlan === "pro"
                ? `Starting your ${TRIAL_DAYS}-day Pro trial — no card needed.`
                : `Starting on the Free plan. You'll still get a ${TRIAL_DAYS}-day Pro trial first, no card needed, before it settles to Free.`}
          </p>
        )}

        {providers.length > 0 && (
          <>
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {providers.map((p) => (
                <a
                  key={p.id}
                  className={`btn secondary${registering && !accepted ? " disabled" : ""}`}
                  href={registering && !accepted ? undefined : socialHref(p.id)}
                  aria-disabled={registering && !accepted}
                  onClick={(e) => {
                    if (registering && !accepted) {
                      e.preventDefault();
                      setError("Please accept the Terms of Service and Privacy Policy to continue.");
                    }
                  }}
                >
                  Continue with {p.label}
                </a>
              ))}
            </div>
            <div className="or-divider">
              <span>or</span>
            </div>
          </>
        )}

        {registering && (
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
          <label htmlFor="password">
            Password{" "}
            {registering && <span className="dim">(min 10 chars, mixed case, a number or symbol)</span>}
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={registering ? 10 : undefined}
          />
        </div>

        {registering && (
          <label className="consent">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              aria-describedby="consent-note"
            />
            <span>
              I have read and agree to the <Link href="/terms" target="_blank">Terms of Service</Link>{" "}
              and <Link href="/privacy" target="_blank">Privacy Policy</Link>. I understand
              TradeMyShow publishes analytics and education, not investment advice,
              and that I am responsible for my own investment decisions.
            </span>
          </label>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn"
            disabled={busy || (registering && !accepted)}
            style={{ flex: 1 }}
          >
            {busy ? "…" : registering ? "Create account" : "Log in"}
          </button>
          {/* The other mode as an equal-weight button, not a small text link
              underneath — someone without an account should not have to
              find a sentence, they should see a second button. */}
          <Link
            href={registering ? "/login" : "/register"}
            className="btn secondary"
            style={{ flex: 1, textAlign: "center" }}
          >
            {registering ? "Log in instead" : "Sign up"}
          </Link>
        </div>

        {registering && (
          <p id="consent-note" className="dim" style={{ fontSize: 11, marginTop: 10 }}>
            A dated copy of the agreement you accept is saved to your account and can be
            downloaded any time from Settings.
          </p>
        )}

        {error && <p className="error">{error}</p>}

        {!registering && (
          <p style={{ marginTop: 14, fontSize: 13 }}>
            <Link href="/reset-password" className="dim">
              Forgot your password?
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
