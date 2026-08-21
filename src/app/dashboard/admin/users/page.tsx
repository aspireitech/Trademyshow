import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminUsers from "@/components/AdminUsers";

export const metadata: Metadata = { title: "Subscribers", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard/admin" className="dim">← Metrics</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>Subscribers</h2>
      <p className="dim" style={{ fontSize: 14, marginBottom: 20 }}>
        Filter by tier, search by name or email, and open an account to see its state.
      </p>
      <AdminUsers />
    </>
  );
}
