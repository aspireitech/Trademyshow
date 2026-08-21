import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { effectivePlan, isTrialing, trialDaysRemaining } from "@/lib/plans";
import CookieNotice from "@/components/CookieNotice";
import DashboardNavActions from "@/components/DashboardNavActions";
import ThemeToggle from "@/components/ThemeToggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const plan = effectivePlan(user);
  const trialing = isTrialing(user);

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/dashboard" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <Link href="/dashboard/compare">Compare</Link>
          <Link href="/dashboard/settings">Settings</Link>
          {user.role === "admin" && <Link href="/dashboard/admin">Admin</Link>}
          <ThemeToggle />
          <span className="dim">{user.name}</span>
          <span className={`badge ${plan !== "free" ? "pro" : ""}`}>
            {trialing ? "Pro trial" : plan}
          </span>
          <DashboardNavActions
            plan={user.plan}
            trialing={trialing}
            trialDaysRemaining={trialDaysRemaining(user)}
          />
        </div>
      </nav>
      <main style={{ padding: "26px 0 60px" }}>{children}</main>
      <CookieNotice />
    </div>
  );
}
