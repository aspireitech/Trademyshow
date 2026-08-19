import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { addHolding, getGroup, listHoldings, removeHolding } from "@/lib/db";
import { getStockInfo } from "@/lib/marketdata";
import { effectiveLimits, effectivePlan } from "@/lib/plans";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const { symbol, quantity } = (await req.json().catch(() => ({}))) as {
    symbol?: string;
    quantity?: number;
  };
  if (!symbol || !getStockInfo(symbol)) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 400 });
  }
  const qty = quantity && quantity > 0 ? quantity : 1;

  const existing = listHoldings(group.id);
  if (existing.some((h) => h.symbol === symbol.toUpperCase())) {
    return NextResponse.json({ error: "symbol already in group" }, { status: 409 });
  }
  const limits = effectiveLimits(user);
  if (existing.length >= limits.maxHoldingsPerGroup) {
    return NextResponse.json(
      { error: `The ${effectivePlan(user)} plan allows up to ${limits.maxHoldingsPerGroup} stocks per watchlist. Upgrade for more.` },
      { status: 403 },
    );
  }
  const holding = addHolding(group.id, symbol, qty);
  return NextResponse.json({ holding }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol query param required" }, { status: 400 });
  const ok = removeHolding(group.id, symbol);
  if (!ok) return NextResponse.json({ error: "holding not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
