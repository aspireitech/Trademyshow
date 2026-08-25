"use client";

import { useState } from "react";
import { apiPost } from "@/lib/apiClient";

/**
 * The market letter sign-up.
 *
 * One field, because every extra one costs conversions, and no account
 * required — the address is the whole ask. The promise is specific ("what
 * moved and why, weekday mornings") rather than "stay updated", because a
 * vague promise is what people unsubscribe from.
 */
export default function NewsletterSignup({ source = "landing" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const { ok, data } = await apiPost<{ error?: string }>("/api/newsletter", { email, source });
    if (ok) {
      setState("done");
      setEmail("");
    } else {
      setState("error");
      setMessage(data.error ?? "That did not go through. Try again in a moment.");
    }
  }

  if (state === "done") {
    return (
      <div className="newsletter">
        <p className="gain" role="status">
          <strong>You&apos;re on the list.</strong> The next letter goes out on the following
          market morning. Every one has an unsubscribe link at the bottom.
        </p>
      </div>
    );
  }

  return (
    <div className="newsletter">
      <div className="newsletter-copy">
        <h3>The market letter</h3>
        <p className="dim">
          What moved, by how much, and the arithmetic behind it — weekday mornings, free. No
          tips, no forecasts, no account needed.
        </p>
      </div>
      <form onSubmit={submit} className="newsletter-form">
        <input
          className="input"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address for the market letter"
        />
        <button type="submit" className="btn" disabled={state === "busy"}>
          {state === "busy" ? "Signing up…" : "Send it to me"}
        </button>
      </form>
      {state === "error" && <p className="act-note loss" role="alert">{message}</p>}
    </div>
  );
}
