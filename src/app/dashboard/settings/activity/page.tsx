import type { Metadata } from "next";
import ActivitySection from "@/components/settings/ActivitySection";

export const metadata: Metadata = { title: "Activity", robots: { index: false, follow: false } };

export default function Page() {
  return <ActivitySection />;
}
