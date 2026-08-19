import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PLAN_PRICING } from "@/lib/plans";

/** Business metrics. Admin-only — this is every user's data in aggregate. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const db = getDb();
  const scalar = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n;

  const totalUsers = scalar("SELECT COUNT(*) AS n FROM users");
  const verified = scalar("SELECT COUNT(*) AS n FROM users WHERE email_verified_at IS NOT NULL");
  const pro = scalar("SELECT COUNT(*) AS n FROM users WHERE plan = 'pro'");
  const premium = scalar("SELECT COUNT(*) AS n FROM users WHERE plan = 'premium'");
  const trialing = scalar(
    "SELECT COUNT(*) AS n FROM users WHERE plan = 'free' AND trial_ends_at > datetime('now')",
  );
  const newLast30 = scalar("SELECT COUNT(*) AS n FROM users WHERE created_at > datetime('now', '-30 days')");
  const activeLast7 = scalar(
    "SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE last_seen_at > datetime('now', '-7 days')",
  );

  // MRR from list prices. Real revenue comes from Stripe; this is the in-app view.
  const mrrCents = pro * PLAN_PRICING.pro.monthlyUsd * 100 + premium * PLAN_PRICING.premium.monthlyUsd * 100;
  const paying = pro + premium;

  return NextResponse.json({
    users: { total: totalUsers, verified, newLast30, activeLast7 },
    plans: { free: totalUsers - paying, trialing, pro, premium },
    revenue: {
      payingUsers: paying,
      mrrUsd: mrrCents / 100,
      arpuUsd: paying ? mrrCents / 100 / paying : 0,
      conversionPct: totalUsers ? Number(((paying / totalUsers) * 100).toFixed(2)) : 0,
    },
    content: {
      watchlists: scalar("SELECT COUNT(*) AS n FROM groups"),
      holdings: scalar("SELECT COUNT(*) AS n FROM holdings"),
      insights: scalar("SELECT COUNT(*) AS n FROM digests"),
      alerts: scalar("SELECT COUNT(*) AS n FROM alerts"),
    },
    referrals: {
      pending: scalar("SELECT COUNT(*) AS n FROM referrals WHERE status = 'pending'"),
      converted: scalar("SELECT COUNT(*) AS n FROM referrals WHERE status = 'converted'"),
    },
  });
}
