import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createGroup, listGroups, listHoldings } from "@/lib/db";
import { limitsFor } from "@/lib/plans";
import { computeGroupFacts } from "@/lib/digest/engine";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const groups = listGroups(user.id).map((g) => {
    const holdings = listHoldings(g.id);
    const facts = computeGroupFacts(g.name, holdings);
    return {
      ...g,
      holdingsCount: holdings.length,
      totalValue: facts.totalValue,
      changePct: facts.changePct,
    };
  });
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const limits = limitsFor(user.plan);
  if (listGroups(user.id).length >= limits.maxGroups) {
    return NextResponse.json(
      { error: `The ${user.plan} plan allows up to ${limits.maxGroups} group(s). Upgrade to Pro for more.` },
      { status: 403 },
    );
  }
  const group = createGroup(user.id, name.trim());
  return NextResponse.json({ group }, { status: 201 });
}
