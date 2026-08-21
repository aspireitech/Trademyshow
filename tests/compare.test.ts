/**
 * The comparison tool. Rebasing is the whole point: raw prices tell you which
 * share costs more, not which performed better.
 */
import { describe, expect, it } from "vitest";
import { compareSymbols, MAX_COMPARE } from "@/lib/insight/compare";

const asOf = new Date("2026-08-14T16:00:00Z");

describe("compareSymbols", () => {
  it("rebases every series to 0% at the start of the window", () => {
    const c = compareSymbols(["AAPL", "SPY"], "1Y", asOf);
    expect(c.series).toHaveLength(2);
    for (const s of c.series) {
      expect(s.points[0].pct).toBe(0);
    }
  });

  it("puts a cheap and an expensive instrument on a comparable scale", () => {
    // The failure this prevents: a $500 share and a $20 share on one price
    // axis is a chart about share price, not about performance.
    const c = compareSymbols(["NVDA", "KO"], "1Y", asOf);
    const finals = c.series.map((s) => Math.abs(s.totalReturnPct));
    expect(finals.every((f) => f < 1000)).toBe(true);
    expect(c.series.every((s) => s.points.every((p) => Number.isFinite(p.pct)))).toBe(true);
  });

  it("reports the best and worst over the window with the gap between them", () => {
    const c = compareSymbols(["AAPL", "NVDA", "SPY"], "1Y", asOf);
    const best = c.series.find((s) => s.symbol === c.bestSymbol)!;
    const worst = c.series.find((s) => s.symbol === c.worstSymbol)!;
    expect(best.totalReturnPct).toBeGreaterThanOrEqual(worst.totalReturnPct);
    expect(c.spreadPct).toBeCloseTo(best.totalReturnPct - worst.totalReturnPct, 1);
  });

  it("caps how many series it will draw", () => {
    const c = compareSymbols(["AAPL", "NVDA", "SPY", "KO", "MSFT", "AMD"], "1Y", asOf);
    expect(c.series.length).toBeLessThanOrEqual(MAX_COMPARE);
  });

  it("de-duplicates and normalises case", () => {
    const c = compareSymbols(["aapl", "AAPL", "Aapl"], "1Y", asOf);
    expect(c.series).toHaveLength(1);
    expect(c.series[0].symbol).toBe("AAPL");
  });

  it("skips unknown symbols rather than failing the whole comparison", () => {
    const c = compareSymbols(["AAPL", "NOTREAL"], "1Y", asOf);
    expect(c.series.map((s) => s.symbol)).toEqual(["AAPL"]);
  });

  it("reports a zero spread for a single series", () => {
    expect(compareSymbols(["AAPL"], "1Y", asOf).spreadPct).toBe(0);
  });

  it("is deterministic, so a shared link shows the same chart", () => {
    expect(compareSymbols(["AAPL", "SPY"], "6M", asOf)).toEqual(
      compareSymbols(["AAPL", "SPY"], "6M", asOf),
    );
  });

  it("honours the timeframe", () => {
    const short = compareSymbols(["AAPL"], "1M", asOf);
    const long = compareSymbols(["AAPL"], "1Y", asOf);
    expect(long.series[0].points.length).toBeGreaterThan(short.series[0].points.length);
  });
});
