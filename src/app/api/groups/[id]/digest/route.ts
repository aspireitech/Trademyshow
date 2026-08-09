import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getGroup, latestDigest, listHoldings, saveDigest } from "@/lib/db";
import { computeGroupFacts } from "@/lib/digest/engine";
import { writeDigest } from "@/lib/digest/writer";
import { limitsFor } from "@/lib/plans";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
  return NextResponse.json({ digest: latestDigest(group.id) });
}

export async function POST(_req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const holdings = listHoldings(group.id);
  if (holdings.length === 0) {
    return NextResponse.json({ error: "add at least one stock to generate a digest" }, { status: 400 });
  }

  const facts = computeGroupFacts(group.name, holdings);
  const deep = limitsFor(user.plan).deepDigest;
  const written = await writeDigest(facts, deep);
  const digest = saveDigest(group.id, facts.asOf, written.headline, written.body, facts, written.writer);
  return NextResponse.json({ digest }, { status: 201 });
}
