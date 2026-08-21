import type { Metadata } from "next";
import SecuritySection from "@/components/settings/SecuritySection";

export const metadata: Metadata = { title: "Security", robots: { index: false, follow: false } };

export default function Page() {
  return <SecuritySection />;
}
