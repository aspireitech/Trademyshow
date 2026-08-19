import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStockInfo } from "@/lib/marketdata";
import { effectiveLimits } from "@/lib/plans";

const MAX_ALERTS = 50;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const alerts = getDb()
    .prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY id DESC")
    .all(user.id);
  return NextResponse.json({ alerts });
}

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!effectiveLimits(user).expectations) {
    return NextResponse.json({ error: "Alerts are a Pro feature." }, { status: 403 });
  }

  const { symbol, direction, threshold } = (await req.json().catch(() => ({}))) as {
    symbol?: string; direction?: string; threshold?: number;
  };
  if (!symbol || !getStockInfo(symbol)) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 400 });
  }
  if (direction !== "above" && direction !== "below") {
    return NextResponse.json({ error: "direction must be above or below" }, { status: 400 });
  }
  if (typeof threshold !== "number" || threshold < 0 || threshold > 100) {
    return NextResponse.json({ error: "threshold must be between 0 and 100" }, { status: 400 });
  }

  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ?").get(user.id) as { n: number };
  if (count.n >= MAX_ALERTS) {
    return NextResponse.json({ error: `Up to ${MAX_ALERTS} alerts per account.` }, { status: 403 });
  }

  db.prepare("INSERT INTO alerts (user_id, symbol, direction, threshold) VALUES (?, ?, ?, ?)")
    .run(user.id, symbol.toUpperCase(), direction, threshold);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const changes = getDb().prepare("DELETE FROM alerts WHERE id = ? AND user_id = ?").run(id, user.id).changes;
  return NextResponse.json({ ok: changes > 0 });
}
