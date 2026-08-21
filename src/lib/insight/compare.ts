import { getHistory, getStockInfo } from "../marketdata";
import { scoreStock } from "./score";
import type { Timeframe } from "../types";

/**
 * Compare instruments on one normalised chart.
 *
 * Everything is rebased to 0% at the start of the window, because comparing
 * raw prices tells you which share costs more, not which performed better —
 * a $500 stock and a $20 stock on the same axis is a chart about nothing.
 *
 * This exists because the product's central question, "why did my holding
 * move", is usually answered by something outside the holding: the sector, the
 * index, the whole market. A stock down 3% on a day its sector fell 4% is a
 * different story from one that fell alone.
 */

export const MAX_COMPARE = 4;

export interface ComparisonSeries {
  symbol: string;
  name: string;
  sector: string;
  /** Percent change from the first point in the window. */
  points: { t: string; pct: number }[];
  totalReturnPct: number;
  score: number | null;
  band: string | null;
}

export interface Comparison {
  timeframe: Timeframe;
  series: ComparisonSeries[];
  /** Best and worst over the window, stated as fact rather than ranking. */
  bestSymbol: string | null;
  worstSymbol: string | null;
  spreadPct: number;
}

export function compareSymbols(
  symbols: string[],
  timeframe: Timeframe = "1Y",
  asOf: Date = new Date(),
): Comparison {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, MAX_COMPARE);
  const series: ComparisonSeries[] = [];

  for (const symbol of unique) {
    const info = getStockInfo(symbol);
    if (!info) continue;

    const history = getHistory(symbol, timeframe, asOf);
    if (history.length < 2) continue;

    const base = history[0].price;
    if (base <= 0) continue;

    const points = history.map((p) => ({
      t: p.t,
      pct: Number((((p.price - base) / base) * 100).toFixed(2)),
    }));
    const scored = scoreStock(symbol, asOf);

    series.push({
      symbol,
      name: info.name,
      sector: info.sector,
      points,
      totalReturnPct: points[points.length - 1].pct,
      score: scored ? Math.round(scored.score) : null,
      band: scored ? scored.band : null,
    });
  }

  const ranked = [...series].sort((a, b) => b.totalReturnPct - a.totalReturnPct);
  return {
    timeframe,
    series,
    bestSymbol: ranked[0]?.symbol ?? null,
    worstSymbol: ranked[ranked.length - 1]?.symbol ?? null,
    spreadPct:
      ranked.length > 1
        ? Number((ranked[0].totalReturnPct - ranked[ranked.length - 1].totalReturnPct).toFixed(2))
        : 0,
  };
}
