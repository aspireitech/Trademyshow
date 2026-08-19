import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminStats from "@/components/AdminStats";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  // Not a 403 page: someone who is not an admin has no business knowing this
  // route exists.
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <>
      <h2 style={{ marginBottom: 4 }}>Business metrics</h2>
      <p className="dim" style={{ fontSize: 14, marginBottom: 20 }}>
        In-app view. Stripe remains the source of truth for money actually collected.
      </p>
      <AdminStats />
    </>
  );
}
