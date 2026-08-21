import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import DataSection from "@/components/settings/DataSection";

/**
 * Export, the signed agreement, and account deletion.
 *
 * The section existed and the settings nav linked to it, but the route did
 * not — so "Your data" was a 404. That is the page where a user exercises
 * access and erasure, which makes a dead link there a compliance problem
 * rather than a broken link.
 */
export const metadata: Metadata = {
  title: "Your data",
  robots: { index: false, follow: false },
};

export default async function DataPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <DataSection />;
}
