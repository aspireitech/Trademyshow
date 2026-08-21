import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { audit } from "@/lib/security";

/**
 * Subscriber list for the admin panel.
 *
 * Returns the operational facts an admin needs and nothing more — no password
 * hashes, no TOTP secrets, no session tokens. An admin panel is a high-value
 * target precisely because it aggregates everyone.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const plan = params.get("plan");
  const query = (params.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(params.get("offset") ?? 0), 0);

  const where: string[] = [];
  const args: unknown[] = [];

  if (plan === "trialing") {
    where.push("plan = 'free' AND trial_ends_at > datetime('now')");
  } else if (plan === "paused") {
    where.push("paused_until > datetime('now')");
  } else if (plan && ["free", "pro", "premium"].includes(plan)) {
    where.push("plan = ?");
    args.push(plan);
  }
  if (query) {
    where.push("(LOWER(email) LIKE ? OR LOWER(name) LIKE ?)");
    args.push(`%${query}%`, `%${query}%`);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT id, email, name, plan, role, trial_ends_at, paused_until,
              email_verified_at, totp_enabled_at, created_at
       FROM users ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, limit, offset) as Record<string, string | number | null>[];

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM users ${clause}`).get(...args) as { n: number }
  ).n;

  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS all_users,
         SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) AS free,
         SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) AS pro,
         SUM(CASE WHEN plan = 'premium' THEN 1 ELSE 0 END) AS premium,
         SUM(CASE WHEN plan = 'free' AND trial_ends_at > datetime('now') THEN 1 ELSE 0 END) AS trialing,
         SUM(CASE WHEN paused_until > datetime('now') THEN 1 ELSE 0 END) AS paused
       FROM users`,
    )
    .get() as Record<string, number>;

  audit(user.id, "admin.users_listed", plan ?? "all", req);

  return NextResponse.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      plan: r.plan,
      role: r.role,
      trialEndsAt: r.trial_ends_at,
      pausedUntil: r.paused_until,
      emailVerified: Boolean(r.email_verified_at),
      twoFactor: Boolean(r.totp_enabled_at),
      createdAt: r.created_at,
    })),
    total,
    counts,
  });
}
