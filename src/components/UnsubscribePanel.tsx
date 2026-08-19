"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPost } from "@/lib/apiClient";

/**
 * One click, no login, no "are you sure?" — the alternative to an easy
 * unsubscribe is a spam complaint, which costs far more than the subscriber.
 */
export default function UnsubscribePanel() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!token) {
      setState("failed");
      return;
    }
    void (async () => {
      const { ok } = await apiPost("/api/account/unsubscribe", { token });
      setState(ok ? "done" : "failed");
    })();
  }, [token]);

  return (
    <div className="card" style={{ maxWidth: 460, margin: "60px auto" }}>
      {state === "working" && <p className="dim">Updating your preferences…</p>}
      {state === "done" && (
        <>
          <h3>You&apos;re unsubscribed</h3>
          <p className="dim" style={{ fontSize: 14 }}>
            No more insight emails. Your account and watchlists are untouched — sign in any time to
            read your insights on the site, or turn email back on in settings.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link className="btn secondary" href="/dashboard/settings">
              Email settings
            </Link>
          </p>
        </>
      )}
      {state === "failed" && (
        <>
          <h3>That link didn&apos;t work</h3>
          <p className="dim" style={{ fontSize: 14 }}>
            The unsubscribe link looks incomplete. Sign in and switch emails off in settings, and
            they will stop immediately.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
