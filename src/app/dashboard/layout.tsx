import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import DashboardNavActions from "@/components/DashboardNavActions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/dashboard" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <span className="dim">{user.name}</span>
          <span className={`badge ${user.plan === "pro" ? "pro" : ""}`}>{user.plan}</span>
          <DashboardNavActions plan={user.plan} />
        </div>
      </nav>
      <main style={{ padding: "26px 0 60px" }}>{children}</main>
    </div>
  );
}
