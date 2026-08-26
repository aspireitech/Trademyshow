import type { Metadata } from "next";
import { Suspense } from "react";
import BillingSection from "@/components/settings/BillingSection";

export const metadata: Metadata = { title: "Plan & billing", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<section className="card"><h3>Plan &amp; billing</h3><p className="dim">Loading…</p></section>}>
      <BillingSection />
    </Suspense>
  );
}
