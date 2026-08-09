"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardNavActions({ plan }: { plan: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    await fetch("/api/billing/upgrade", { method: "POST" });
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
      {plan !== "pro" && (
        <button className="btn small" onClick={upgrade} disabled={busy}>
          {busy ? "…" : "Upgrade to Pro"}
        </button>
      )}
      <button className="btn small secondary" onClick={logout}>
        Log out
      </button>
    </>
  );
}
