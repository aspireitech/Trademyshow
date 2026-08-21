import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/marketdata";
import { searchSymbols } from "@/lib/providers/feed";
import { limitRequest, tooManyRequests } from "@/lib/security";

/**
 * Ticker type-ahead, open to everyone.
 *
 * Deliberately not behind a session. Search is the first thing a visitor does
 * on a market site, and making them create an account to find out whether we
 * cover their holdings loses the visit — they leave to check somewhere that
 * just answers.
 *
 * Two letters is enough to be useful ("APL" → APLM, APLE, PAPL), which is why
 * the minimum is two rather than three.
 */
export async function GET(req: Request) {
  const limit = limitRequest(req, "api");
  if (!limit.allowed) return tooManyRequests(limit);

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [], query: q });

  // The shipped universe answers first and instantly; the vendor fills the
  // rest of the list. A vendor failure shortens the dropdown, never empties it.
  const local = searchStocks(q, 8);
  const { results } = await searchSymbols(q, local, 10);

  return NextResponse.json({ results, query: q });
}
