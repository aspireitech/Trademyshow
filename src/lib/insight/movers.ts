import { getQuote, UNIVERSE } from "../marketdata";
import { scoreStock } from "./score";
import type { AssetClass } from "../types";

/**
 * Market-wide movers.
 *
 * The product's weakness on day one is an empty watchlist: nothing to explain
 * means nothing to read. This gives every visitor something worth returning
 * for before they have added a single holding, computed from the same engine
 * as everything else rather than a separate feed.
 *
 * Note what is deliberately absent: no "top picks", no ranking by what we
 * think will do well. These are descriptive facts about what already moved.
 */

export interface Mover {
  symbol: string;
  name: string;
  sector: string;
  assetClass: AssetClass;
  price: number;
  changePct: number;
  /** Present only where the scoring engine has enough history. */
  score: number | null;
  band: string | null;
}

export interface Movers {
  asOf: string;
  gainers: Mover[];
  losers: Mover[];
  /** Biggest absolute moves, gainers and losers together. */
  mostActive: Mover[];
}

function toMover(symbol: string, asOf: Date): Mover | null {
  const info = UNIVERSE.find((s) => s.symbol === symbol);
  if (!info) return null;
  const quote = getQuote(symbol, asOf);
  const scored = scoreStock(symbol, asOf);
  return {
    symbol,
    name: info.name,
    sector: info.sector,
    assetClass: info.assetClass ?? "stock",
    price: quote.price,
    changePct: quote.changePct,
    score: scored ? Math.round(scored.score) : null,
    band: scored ? scored.band : null,
  };
}

export function marketMovers(asOf: Date = new Date(), limit = 8): Movers {
  const all = UNIVERSE.map((s) => toMover(s.symbol, asOf)).filter((m): m is Mover => m !== null);

  const byChange = [...all].sort((a, b) => b.changePct - a.changePct);
  const gainers = byChange.filter((m) => m.changePct > 0).slice(0, limit);
  const losers = byChange
    .filter((m) => m.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, limit);

  const mostActive = [...all]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit);

  return { asOf: asOf.toISOString().slice(0, 10), gainers, losers, mostActive };
}

/**
 * How the whole tracked universe moved, as one sentence's worth of numbers.
 * Useful context: a holding down 1% on a day the market fell 2% is a different
 * story from the same holding falling alone.
 */
export interface MarketBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
  averageChangePct: number;
}

export function marketBreadth(asOf: Date = new Date()): MarketBreadth {
  let advancing = 0, declining = 0, unchanged = 0, total = 0;

  for (const s of UNIVERSE) {
    const { changePct } = getQuote(s.symbol, asOf);
    total += changePct;
    if (changePct > 0.05) advancing++;
    else if (changePct < -0.05) declining++;
    else unchanged++;
  }

  return {
    advancing,
    declining,
    unchanged,
    averageChangePct: Number((total / UNIVERSE.length).toFixed(2)),
  };
}
