"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardNavActions({
  plan,
  trialing,
  trialDaysRemaining,
}: {
  plan: string;
  trialing: boolean;
  trialDaysRemaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {trialing && (
        <span className="dim" style={{ fontSize: 12 }}>
          {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} of Pro left
        </span>
      )}
      {plan === "free" && (
        <button className="btn small" onClick={upgrade} disabled={busy}>
          {busy ? "…" : trialing ? "Keep Pro" : "Upgrade"}
        </button>
      )}
      <button className="btn small secondary" onClick={logout}>
        Log out
      </button>
    </>
  );
}
