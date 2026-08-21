import { NextResponse } from "next/server";
import { marketBreadth, marketMovers } from "@/lib/insight/movers";

/** Public: descriptive market facts, no account needed. */
export async function GET(req: Request) {
  const limit = Math.min(20, Math.max(3, Number(new URL(req.url).searchParams.get("limit") ?? 6)));
  return NextResponse.json({
    ...marketMovers(new Date(), limit),
    breadth: marketBreadth(),
  });
}
