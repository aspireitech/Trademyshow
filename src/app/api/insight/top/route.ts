import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { topScores } from "@/lib/insight/trackrecord";

/** Highest-scoring stocks right now, with their component breakdowns. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit") ?? 12));
  return NextResponse.json({ scores: topScores(limit) });
}
