import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { effectivePlan, isTrialing, trialDaysRemaining } from "@/lib/plans";
import DashboardNavActions from "./DashboardNavActions";
import GlobalSearch from "./GlobalSearch";
import ThemeToggle from "./ThemeToggle";

/**
 * One header for the whole site.
 *
 * There used to be three — a marketing bar on the landing page, a second on
 * the market screens, a third inside the dashboard — which is why signing in
 * felt like arriving at a different product. Same bar everywhere, with the
 * search box in it, so the first thing a visitor learns keeps working on every
 * page they reach afterwards.
 */
export default async function SiteHeader() {
  const user = await currentUser();
  const plan = user ? effectivePlan(user) : null;

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        Trade<span>MyShow</span>
      </Link>

      <GlobalSearch />

      <div className="topbar-actions">
        <ThemeToggle />
        {user ? (
          <>
            <Link href="/dashboard" className="topbar-link">Dashboard</Link>
            <Link href="/dashboard/settings" className="topbar-link">Settings</Link>
            {user.role === "admin" && (
              <Link href="/dashboard/admin" className="topbar-link">Admin</Link>
            )}
            <span className={`badge ${plan !== "free" ? "pro" : ""}`}>
              {isTrialing(user) ? "Pro trial" : plan}
            </span>
            <DashboardNavActions
              plan={user.plan}
              trialing={isTrialing(user)}
              trialDaysRemaining={trialDaysRemaining(user)}
            />
          </>
        ) : (
          <>
            <Link href="/pricing" className="topbar-link">Pricing</Link>
            <Link href="/login" className="topbar-link">Log in</Link>
            <Link href="/register" className="btn small">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
}
