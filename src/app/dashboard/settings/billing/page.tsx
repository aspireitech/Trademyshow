import type { Metadata } from "next";
import BillingSection from "@/components/settings/BillingSection";

export const metadata: Metadata = { title: "Plan & billing", robots: { index: false, follow: false } };

export default function Page() {
  return <BillingSection />;
}
