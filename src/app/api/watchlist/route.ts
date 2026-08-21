import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { addHolding, createGroup, listGroups, listHoldings, removeHolding } from "@/lib/db";
import { getStockInfo } from "@/lib/marketdata";
import { effectiveLimits, effectivePlan } from "@/lib/plans";
import { resolveSymbol } from "@/lib/providers/feed";

/**
 * Add a symbol to a watchlist in one call.
 *
 * The old path made the caller create a group, then list groups, then post a
 * holding — three round trips for what the visitor experiences as one click.
 * This endpoint takes either an existing list or the name of a new one, which
 * is exactly the choice the button offers.
 */

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ signedIn: false, lists: [] }, { status: 200 });

  const symbol = new URL(req.url).searchParams.get("symbol")?.toUpperCase() ?? null;
  const limits = effectiveLimits(user);

  const lists = listGroups(user.id).map((g) => {
    const holdings = listHoldings(g.id);
    return {
      id: g.id,
      name: g.name,
      count: holdings.length,
      full: holdings.length >= limits.maxHoldingsPerGroup,
      contains: symbol ? holdings.some((h) => h.symbol === symbol) : false,
    };
  });

  return NextResponse.json({
    signedIn: true,
    lists,
    canCreate: lists.length < limits.maxGroups,
    maxLists: limits.maxGroups,
    maxPerList: limits.maxHoldingsPerGroup,
    plan: effectivePlan(user),
  });
}

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { symbol, listId, newListName } = (await req.json().catch(() => ({}))) as {
    symbol?: string; listId?: number; newListName?: string;
  };

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  const info = getStockInfo(symbol) ?? (await resolveSymbol(symbol));
  if (!info) return NextResponse.json({ error: "unknown symbol" }, { status: 400 });

  const limits = effectiveLimits(user);
  const existing = listGroups(user.id);

  let group = listId ? existing.find((g) => g.id === listId) : undefined;

  // No list chosen and only one exists: it is the one they meant. The button
  // skips the menu in that case too, so the API has to agree with it.
  if (!group && !listId && !newListName && existing.length === 1) group = existing[0];

  if (!group) {
    // Still nothing: either the visitor named a new list, or this is their
    // first ever add and the obvious thing to do is make one for them.
    const name = newListName?.trim() || (existing.length === 0 ? "My watchlist" : "");
    if (!name) return NextResponse.json({ error: "choose a watchlist" }, { status: 400 });
    if (existing.length >= limits.maxGroups) {
      return NextResponse.json(
        {
          error: `The ${effectivePlan(user)} plan keeps ${limits.maxGroups} watchlist${limits.maxGroups === 1 ? "" : "s"}. Upgrade for more.`,
          upgrade: true,
        },
        { status: 403 },
      );
    }
    group = createGroup(user.id, name.slice(0, 60));
  }

  const holdings = listHoldings(group.id);
  if (holdings.some((h) => h.symbol === info.symbol.toUpperCase())) {
    return NextResponse.json({ ok: true, alreadyThere: true, listId: group.id, listName: group.name });
  }
  if (holdings.length >= limits.maxHoldingsPerGroup) {
    return NextResponse.json(
      {
        error: `“${group.name}” holds the ${limits.maxHoldingsPerGroup} stocks the ${effectivePlan(user)} plan allows. Upgrade for more.`,
        upgrade: true,
      },
      { status: 403 },
    );
  }

  addHolding(group.id, info.symbol, 1);
  return NextResponse.json({ ok: true, listId: group.id, listName: group.name }, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const listId = Number(url.searchParams.get("listId"));
  if (!symbol || !listId) {
    return NextResponse.json({ error: "symbol and listId are required" }, { status: 400 });
  }
  if (!listGroups(user.id).some((g) => g.id === listId)) {
    return NextResponse.json({ error: "watchlist not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: removeHolding(listId, symbol) });
}
