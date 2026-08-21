import {
  dayVolume, getHistory, getQuote, marketCap, UNIVERSE, week52Range,
} from "../marketdata";
import { scoreStock } from "./score";
import type { AssetClass } from "../types";

/**
 * Market-wide movers and screens.
 *
 * The product's weakness on day one is an empty watchlist: nothing to explain
 * means nothing to read. These tables give every visitor something worth
 * returning for before they have added a single holding, computed from the
 * same engine as everything else rather than a separate feed.
 *
 * Note what is deliberately absent: no "top picks", no ranking by what we
 * think will do well. These are descriptive facts about what already moved.
 * The Insight Score appears beside each row as context; no table is ever
 * ordered by it.
 */

export interface Mover {
  symbol: string;
  name: string;
  sector: string;
  assetClass: AssetClass;
  price: number;
  changePct: number;
  /** One month of closes, for the row's trend line. */
  spark: number[];
  /** Distance from the 52-week extremes, percent. Negative = below the high. */
  pctFrom52wHigh: number;
  pctFrom52wLow: number;
  /** Session volume and market cap, so a row can be read without a second pass. */
  volume: number;
  marketCap: number;
  /** Present only where the scoring engine has enough history. */
  score: number | null;
  band: string | null;
}

export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  averageChangePct: number;
}

/**
 * Scoring 159 instruments walks a lot of deterministic history, so the full
 * pass is computed once per calendar day per process. The data only changes
 * when the day does, and every caller — gainers, losers, screens, breadth —
 * slices the same array.
 */
const memo = new Map<string, Mover[]>();

function downsample(values: number[], points = 24): number[] {
  if (values.length <= points) return values;
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => values[Math.round(i * step)]);
}

export function allMovers(asOf: Date = new Date()): Mover[] {
  const day = asOf.toISOString().slice(0, 10);
  const hit = memo.get(day);
  if (hit) return hit;

  const out: Mover[] = [];
  for (const info of UNIVERSE) {
    const quote = getQuote(info.symbol, asOf);
    const year = getHistory(info.symbol, "1Y", asOf).map((p) => p.price);
    if (year.length < 2) continue;
    // The vendor's own 52-week extremes where it publishes them: they track
    // intraday highs, which is what every other market site quotes, so
    // computing ours from closes alone would disagree with them visibly.
    const { high: hi, low: lo } = week52Range(info.symbol, asOf);
    const scored = scoreStock(info.symbol, asOf);

    out.push({
      symbol: info.symbol,
      name: info.name,
      sector: info.sector,
      assetClass: info.assetClass ?? "stock",
      price: quote.price,
      changePct: quote.changePct,
      spark: downsample(getHistory(info.symbol, "1M", asOf).map((p) => p.price)),
      pctFrom52wHigh: hi ? Number((((quote.price - hi) / hi) * 100).toFixed(2)) : 0,
      pctFrom52wLow: lo ? Number((((quote.price - lo) / lo) * 100).toFixed(2)) : 0,
      volume: dayVolume(info.symbol, asOf),
      marketCap: marketCap(info.symbol, asOf),
      score: scored ? Math.round(scored.score) : null,
      band: scored ? scored.band : null,
    });
  }

  memo.set(day, out);
  // The process only ever needs today and, briefly, yesterday around midnight.
  if (memo.size > 3) memo.delete(memo.keys().next().value!);
  return out;
}

export type MoverView = "gainers" | "losers" | "active" | "high52" | "low52";

export const VIEW_LABELS: Record<MoverView, string> = {
  gainers: "Top gainers",
  losers: "Top losers",
  active: "Biggest moves",
  high52: "Near 52-week highs",
  low52: "Near 52-week lows",
};

export function moverView(view: MoverView, limit = 50, asOf: Date = new Date()): Mover[] {
  const all = allMovers(asOf);
  switch (view) {
    case "gainers":
      return all.filter((m) => m.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct).slice(0, limit);
    case "losers":
      return all.filter((m) => m.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct).slice(0, limit);
    case "active":
      return [...all].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, limit);
    case "high52":
      // Closest to (or at) the 52-week high first.
      return [...all].sort((a, b) => b.pctFrom52wHigh - a.pctFrom52wHigh).slice(0, limit);
    case "low52":
      return [...all].sort((a, b) => a.pctFrom52wLow - b.pctFrom52wLow).slice(0, limit);
  }
}

export interface Movers {
  asOf: string;
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
}

/** Kept for the dashboard panel and API. */
export function marketMovers(asOf: Date = new Date(), limit = 8): Movers {
  return {
    asOf: asOf.toISOString().slice(0, 10),
    gainers: moverView("gainers", limit, asOf),
    losers: moverView("losers", limit, asOf),
    mostActive: moverView("active", limit, asOf),
  };
}

/**
 * How the whole tracked universe moved, as one sentence's worth of numbers.
 * Useful context: a holding down 1% on a day the market fell 2% is a different
 * story from the same holding falling alone.
 */
export function marketBreadth(asOf: Date = new Date()): MarketBreadth {
  const all = allMovers(asOf);
  let advancing = 0, declining = 0, unchanged = 0, total = 0;
  for (const m of all) {
    total += m.changePct;
    if (m.changePct > 0.05) advancing++;
    else if (m.changePct < -0.05) declining++;
    else unchanged++;
  }
  return {
    advancing,
    declining,
    unchanged,
    averageChangePct: Number((total / all.length).toFixed(2)),
  };
}
