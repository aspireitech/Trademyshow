import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  dayVolume, getHistory, getQuote, getStockInfo, marketCap, marketCapIsEstimated,
  rangeChangePct, round2, symbolStats, week52Range,
} from "@/lib/marketdata";
import { getNews } from "@/lib/news";
import { scoreStock } from "@/lib/insight/score";
import { expectationsFor } from "@/lib/insight/expectation";
import { effectiveLimits, PLAN_LIMITS } from "@/lib/plans";
import { resolveSymbol, sourceFor, sourceText } from "@/lib/providers/feed";
import { refreshSymbolDeeply } from "@/lib/marketrefresh";
import { limitRequest, tooManyRequests } from "@/lib/security";
import { TIMEFRAMES, type Timeframe } from "@/lib/types";

type Params = { params: Promise<{ symbol: string }> };

/** Open, high and low from the generated session, for a simulated page. */
function sessionRange(symbol: string): { open: number; high: number; low: number } | null {
  const bars = getHistory(symbol, "1D").map((p) => p.price);
  if (bars.length < 2) return null;
  return { open: round2(bars[0]), high: round2(Math.max(...bars)), low: round2(Math.min(...bars)) };
}

/**
 * Everything one stock page needs.
 *
 * Open to signed-out visitors, on purpose. The old behaviour — 401 unless you
 * had an account — meant the product could not be evaluated at all before
 * signing up, which is the wrong order: prove the analysis, then ask. What a
 * visitor does not get is the exact score, which is the same line the free
 * plan sits behind.
 */
export async function GET(req: Request, { params }: Params) {
  const limit = limitRequest(req, "api");
  if (!limit.allowed) return tooManyRequests(limit);

  const user = await currentUser();
  const { symbol: raw } = await params;

  // Shipped universe first, then anything learned from the vendor, then the
  // vendor itself — so a small cap nobody has looked up still gets a page.
  const info = getStockInfo(raw) ?? (await resolveSymbol(raw));
  if (!info) return NextResponse.json({ error: "unknown symbol" }, { status: 404 });

  const rangeParam = (new URL(req.url).searchParams.get("range") ?? "1M") as Timeframe;
  const range = TIMEFRAMES.includes(rangeParam) ? rangeParam : "1M";

  // If this symbol has nothing real behind it, fetch it now rather than
  // showing a simulated page and hoping the scheduler catches up. One symbol
  // is a couple of requests, and it only happens on the first view.
  if (sourceFor(info.symbol).source === "simulated") {
    await refreshSymbolDeeply(info.symbol).catch(() => false);
  }

  const quote = getQuote(info.symbol);
  const history = getHistory(info.symbol, range);
  const trends = Object.fromEntries(TIMEFRAMES.map((tf) => [tf, rangeChangePct(info.symbol, tf)]));
  const news = getNews(info.symbol, quote.changePct);
  const stats = symbolStats(info.symbol);
  const range52 = week52Range(info.symbol);
  const label = sourceFor(info.symbol);
  const simulated = label.source === "simulated";

  // The session's own bars, used only to complete a simulated page. Under a
  // real feed the vendor's figures are the only ones printed.
  const session = simulated ? sessionRange(info.symbol) : null;

  // Signed-out visitors are held to the free plan's limits — the same line,
  // not a stricter one, so what they see is what a free account would see.
  const limits = user ? effectiveLimits(user) : PLAN_LIMITS.free;
  const full = scoreStock(info.symbol);

  const score = full
    ? limits.exactScore
      ? full
      : { ...full, score: Math.round(full.score / 10) * 10, components: [], masked: true }
    : null;

  const expectations = full && limits.expectations ? expectationsFor(full.band) : null;

  return NextResponse.json({
    info,
    quote,
    range,
    history,
    trends,
    news,
    score,
    expectations,
    stats: {
      // Two modes, never mixed. When the page is showing a real quote, only
      // what the vendor actually supplied is filled in — a blank cell is
      // honest, a simulated volume printed beside a real price is not. When
      // the whole page is already labelled simulated, the simulation fills
      // every cell, because there is nothing left to mislead anyone about.
      open: stats?.open ?? session?.open ?? null,
      dayHigh: stats?.dayHigh ?? session?.high ?? null,
      dayLow: stats?.dayLow ?? session?.low ?? null,
      volume: stats?.volume ?? (simulated ? dayVolume(info.symbol) : null),
      currency: stats?.currency ?? "USD",
      exchange: stats?.exchange ?? null,
      week52High: range52.high,
      week52Low: range52.low,
      marketCap: marketCap(info.symbol),
      marketCapEstimated: marketCapIsEstimated(info.symbol),
    },
    source: { ...label, text: sourceText(label) },
    signedIn: Boolean(user),
  });
}
