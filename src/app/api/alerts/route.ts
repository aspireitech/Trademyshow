import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStockInfo } from "@/lib/marketdata";
import { effectiveLimits, effectivePlan } from "@/lib/plans";
import { resolveSymbol } from "@/lib/providers/feed";
import type { AlertKind } from "@/lib/types";

interface AlertRow {
  id: number; symbol: string; kind: AlertKind; direction: "above" | "below";
  threshold: number; last_fired_at: string | null; created_at: string;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const symbol = new URL(req.url).searchParams.get("symbol");
  const rows = (
    symbol
      ? getDb()
          .prepare("SELECT * FROM alerts WHERE user_id = ? AND symbol = ? ORDER BY id DESC")
          .all(user.id, symbol.toUpperCase())
      : getDb().prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY id DESC").all(user.id)
  ) as AlertRow[];

  const limits = effectiveLimits(user);
  const total = (
    getDb().prepare("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ?").get(user.id) as { n: number }
  ).n;

  return NextResponse.json({
    alerts: rows.map((r) => ({
      id: r.id, symbol: r.symbol, kind: r.kind, direction: r.direction,
      threshold: r.threshold, lastFiredAt: r.last_fired_at, createdAt: r.created_at,
    })),
    used: total,
    limit: limits.maxAlerts,
    plan: effectivePlan(user),
  });
}

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { symbol, direction, threshold, kind } = (await req.json().catch(() => ({}))) as {
    symbol?: string; direction?: string; threshold?: number; kind?: string;
  };

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  const info = getStockInfo(symbol) ?? (await resolveSymbol(symbol));
  if (!info) return NextResponse.json({ error: "unknown symbol" }, { status: 400 });

  if (direction !== "above" && direction !== "below") {
    return NextResponse.json({ error: "direction must be above or below" }, { status: 400 });
  }
  const alertKind: AlertKind = kind === "price" ? "price" : "score";

  // A score is a 0-100 reading; a price is any positive number. Validating them
  // against the same range would either reject a $5,000 share or accept a
  // score of 900.
  if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) {
    return NextResponse.json({ error: "threshold must be a positive number" }, { status: 400 });
  }
  if (alertKind === "score" && threshold > 100) {
    return NextResponse.json({ error: "a score threshold is between 0 and 100" }, { status: 400 });
  }

  const limits = effectiveLimits(user);
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS n FROM alerts WHERE user_id = ?").get(user.id) as { n: number };
  if (count.n >= limits.maxAlerts) {
    return NextResponse.json(
      {
        error: `The ${effectivePlan(user)} plan keeps up to ${limits.maxAlerts} alerts. Upgrade for more.`,
        upgrade: true,
      },
      { status: 403 },
    );
  }

  const info_ = db
    .prepare("INSERT INTO alerts (user_id, symbol, kind, direction, threshold) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, info.symbol.toUpperCase(), alertKind, direction, threshold);

  return NextResponse.json({ ok: true, id: Number(info_.lastInsertRowid) }, { status: 201 });
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
