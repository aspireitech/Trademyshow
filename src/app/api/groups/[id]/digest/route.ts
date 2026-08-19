import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getGroup, latestDigest, listHoldings, saveDigest } from "@/lib/db";
import { computeGroupFacts } from "@/lib/digest/engine";
import { writeDigest } from "@/lib/digest/writer";
import { effectiveLimits } from "@/lib/plans";
import type { DigestPeriod } from "@/lib/types";

function periodOf(url: string): DigestPeriod {
  return new URL(url).searchParams.get("period") === "weekly" ? "weekly" : "daily";
}

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
  return NextResponse.json({ digest: latestDigest(group.id, periodOf(req.url)) });
}

export async function POST(req: Request, { params }: Params) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const group = getGroup(Number(id), user.id);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const holdings = listHoldings(group.id);
  if (holdings.length === 0) {
    return NextResponse.json({ error: "add at least one stock to generate a digest" }, { status: 400 });
  }

  const period = periodOf(req.url);
  const facts = computeGroupFacts(group.name, holdings, new Date(), period);
  const limits = effectiveLimits(user);
  if (period === "weekly" && !limits.weeklyInsight) {
    return NextResponse.json(
      { error: "Weekly insights are a Pro feature. Start a free trial to unlock them." },
      { status: 403 },
    );
  }
  const deep = limits.deepDigest;
  const written = await writeDigest(facts, deep);
  const digest = saveDigest(
    group.id,
    facts.asOf,
    written.headline,
    written.body,
    facts,
    written.writer,
    period,
  );
  return NextResponse.json({ digest }, { status: 201 });
}
