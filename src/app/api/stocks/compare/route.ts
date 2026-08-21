import { NextResponse } from "next/server";
import { compareSymbols, MAX_COMPARE } from "@/lib/insight/compare";
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
  return NextResponse.json(compareSymbols(symbols, range));
}
