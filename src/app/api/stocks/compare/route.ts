import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { compareSymbols, MAX_COMPARE } from "@/lib/insight/compare";
import { effectiveLimits, PLAN_LIMITS } from "@/lib/plans";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const symbols = (params.get("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const range = (params.get("range") ?? "1Y") as Timeframe;

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols are required" }, { status: 400 });
  }
  if (!TIMEFRAMES.includes(range)) {
    return NextResponse.json({ error: "unknown range" }, { status: 400 });
  }
  if (symbols.length > MAX_COMPARE) {
    return NextResponse.json(
      { error: `Compare up to ${MAX_COMPARE} at a time — more lines than that is unreadable.` },
      { status: 400 },
    );
  }

  // Enforced here, not only in the UI: a limit that lives in the browser is a
  // suggestion. Signed-out visitors get the free allowance so the feature can
  // still be tried before an account exists.
  const user = await currentUser();
  const allowance = user ? effectiveLimits(user).maxCompare : PLAN_LIMITS.free.maxCompare;

  if (symbols.length > allowance) {
    return NextResponse.json(
      {
        error: `Comparing ${symbols.length} at once is a Pro feature. Your plan compares ${allowance}.`,
        allowance,
        upgrade: "/pricing",
      },
      { status: 402 },
    );
  }

  return NextResponse.json({ ...compareSymbols(symbols, range), allowance });
}
