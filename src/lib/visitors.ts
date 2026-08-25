import crypto from "node:crypto";
import { getDb } from "./db";

/**
 * Visitor counting, without tracking anyone.
 *
 * A visitor is identified by a salted daily hash of their IP and user agent.
 * The salt rotates with the date, so yesterday's identifier cannot be linked
 * to today's — which means this can count returning visitors within a window
 * but cannot build a profile of anybody, and there is nothing here worth
 * subpoenaing.
 *
 * Counted server-side rather than in the browser: ad blockers remove client
 * analytics for a large share of exactly the audience this product attracts,
 * and a number that undercounts by an unknown amount is worse than no number.
 */

export interface VisitorStats {
  uniqueToday: number;
  returningToday: number;
  uniqueLast30: number;
  visitsLast30: number;
  /** Share of visitors seen on more than one distinct day. */
  repeatRatePct: number;
  /** Every page view ever recorded. */
  totalViews: number;
  /**
   * Distinct visitor-days, all time — not distinct people.
   *
   * The identifying hash is salted with the date so yesterday's identifier
   * cannot be linked to today's, which is what stops this from being a
   * tracking system. The price of that is real: one person visiting on three
   * days counts three times here. The label in the UI says "visitor-days" for
   * exactly that reason, because calling it "unique visitors" would be a
   * number the operator would go on to make decisions with.
   */
  uniqueVisitorDays: number;
  /** Visitor-days with more than one view — someone who came back in-session. */
  repeatVisitorDays: number;
  /** Days on which anybody visited at all. */
  activeDays: number;
}

function visitorId(ip: string | null, userAgent: string | null, day: string): string {
  const salt = process.env.AUTH_SECRET ?? "dev-secret-not-for-production";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${day}:${ip ?? "unknown"}:${userAgent ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/** Record one page view. Returns true when this is the visitor's first today. */
export function recordVisit(
  ip: string | null,
  userAgent: string | null,
  path: string,
  now: Date = new Date(),
): { firstToday: boolean; viewsToday: number } {
  const day = now.toISOString().slice(0, 10);
  const id = visitorId(ip, userAgent, day);
  const db = getDb();

  const existing = db
    .prepare("SELECT views FROM visitors WHERE visitor_id = ? AND day = ?")
    .get(id, day) as { views: number } | undefined;

  if (existing) {
    db.prepare("UPDATE visitors SET views = views + 1, last_path = ?, last_seen_at = ? WHERE visitor_id = ? AND day = ?")
      .run(path.slice(0, 120), now.toISOString(), id, day);
    return { firstToday: false, viewsToday: existing.views + 1 };
  }

  db.prepare(
    "INSERT INTO visitors (visitor_id, day, views, last_path, first_seen_at, last_seen_at) VALUES (?, ?, 1, ?, ?, ?)",
  ).run(id, day, path.slice(0, 120), now.toISOString(), now.toISOString());

  return { firstToday: true, viewsToday: 1 };
}

export function visitorStats(now: Date = new Date()): VisitorStats {
  const db = getDb();
  const day = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const n = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...args) as { n: number }).n;

  const uniqueToday = n("SELECT COUNT(*) AS n FROM visitors WHERE day = ?", day);
  const returningToday = n("SELECT COUNT(*) AS n FROM visitors WHERE day = ? AND views > 1", day);
  const uniqueLast30 = n(
    "SELECT COUNT(DISTINCT visitor_id) AS n FROM visitors WHERE day >= ?", from,
  );
  const visitsLast30 = n(
    "SELECT COALESCE(SUM(views), 0) AS n FROM visitors WHERE day >= ?", from,
  );

  const totalViews = n("SELECT COALESCE(SUM(views), 0) AS n FROM visitors");
  const uniqueVisitorDays = n("SELECT COUNT(*) AS n FROM visitors");
  const repeatVisitorDays = n("SELECT COUNT(*) AS n FROM visitors WHERE views > 1");
  const activeDays = n("SELECT COUNT(DISTINCT day) AS n FROM visitors");

  return {
    uniqueToday,
    returningToday,
    uniqueLast30,
    visitsLast30,
    repeatRatePct: uniqueLast30 ? Number(((visitsLast30 / uniqueLast30 - 1) * 100).toFixed(1)) : 0,
    totalViews,
    uniqueVisitorDays,
    repeatVisitorDays,
    activeDays,
  };
}
