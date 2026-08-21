import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { userActivity } from "@/lib/activity";
import { subscriptionState } from "@/lib/billing";
import { getDb, getUserById, listGroups, listHoldings } from "@/lib/db";
import { audit } from "@/lib/security";

/**
 * One subscriber, as an admin sees them.
 *
 * Deliberately a read-only view of operational state: plan, verification,
 * watchlist shape, and their own activity feed. It exposes no credential and
 * no way to act as the user — an admin who needs to reproduce a problem asks
 * the user, rather than the product growing an impersonation feature that
 * cannot be audited from the outside.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentUser();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (admin.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const target = getUserById(Number(id));
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const groups = listGroups(target.id).map((g) => {
    const holdings = listHoldings(g.id);
    return { id: g.id, name: g.name, holdings: holdings.map((h) => h.symbol), createdAt: g.createdAt };
  });

  const counts = getDb()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM digests d JOIN groups g ON g.id = d.group_id WHERE g.user_id = ?) AS insights,
         (SELECT COUNT(*) FROM alerts WHERE user_id = ?) AS alerts,
         (SELECT COUNT(*) FROM sessions WHERE user_id = ? AND revoked_at IS NULL) AS sessions,
         (SELECT COUNT(*) FROM referrals WHERE referrer_id = ?) AS referrals`,
    )
    .get(target.id, target.id, target.id, target.id) as Record<string, number>;

  // Viewing another person's account is itself an auditable act.
  audit(admin.id, "admin.user_viewed", `user ${target.id}`, req);

  return NextResponse.json({
    user: {
      id: target.id,
      email: target.email,
      name: target.name,
      plan: target.plan,
      role: target.role,
      createdAt: target.createdAt,
      emailVerifiedAt: target.emailVerifiedAt,
      totpEnabledAt: target.totpEnabledAt,
      phoneVerifiedAt: target.phoneVerifiedAt,
      emailOptIn: target.emailOptIn,
      referralCode: target.referralCode,
      termsVersion: target.termsVersion,
      termsAcceptedAt: target.termsAcceptedAt,
    },
    subscription: subscriptionState(target),
    groups,
    counts,
    activity: userActivity(target.id, { limit: 20 }).entries,
  });
}
