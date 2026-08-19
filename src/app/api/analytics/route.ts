import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { limitRequest, tooManyRequests } from "@/lib/security";

const ALLOWED = new Set([
  "signup_started", "signup_completed", "watchlist_created", "stock_added",
  "insight_generated", "score_viewed", "upgrade_clicked", "checkout_started",
  "trackrecord_viewed",
]);

/**
 * First-party event capture. No third-party script, no cookies beyond the
 * session we already set, and an allow-list of event names so the table cannot
 * be filled with arbitrary strings.
 */
export async function POST(req: Request) {
  const limit = limitRequest(req, "api");
  if (!limit.allowed) return tooManyRequests(limit);

  const { name, props } = (await req.json().catch(() => ({}))) as {
    name?: string;
    props?: Record<string, unknown>;
  };
  if (!name || !ALLOWED.has(name)) {
    return NextResponse.json({ error: "unknown event" }, { status: 400 });
  }

  const session = await currentSession();
  getDb()
    .prepare("INSERT INTO events (user_id, name, props) VALUES (?, ?, ?)")
    .run(session?.userId ?? null, name, props ? JSON.stringify(props).slice(0, 1000) : null);

  return NextResponse.json({ ok: true });
}

/** Funnel counts for the admin view. */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = getDb()
    .prepare(
      "SELECT name, COUNT(*) AS count FROM events WHERE created_at > datetime('now', '-30 days') GROUP BY name",
    )
    .all() as { name: string; count: number }[];
  return NextResponse.json({ events: rows });
}
