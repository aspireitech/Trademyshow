import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminUserDetail from "@/components/AdminUserDetail";

export const metadata: Metadata = { title: "Subscriber", robots: { index: false, follow: false } };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  const { id } = await params;
  return <AdminUserDetail id={Number(id)} />;
}
