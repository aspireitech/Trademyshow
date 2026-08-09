import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { deleteGroup, getGroup, listHoldings } from "@/lib/db";
import { computeGroupFacts } from "@/lib/digest/engine";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
  const holdings = listHoldings(group.id);
  const facts = computeGroupFacts(group.name, holdings);
  return NextResponse.json({ group, holdings, facts });
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = deleteGroup(Number(id), user.id);
  if (!ok) return NextResponse.json({ error: "group not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
