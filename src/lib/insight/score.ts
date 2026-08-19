import { getHistory, getQuote, getStockInfo, round2 } from "../marketdata";
import { getNews } from "../news";
import type { NewsItem, Timeframe } from "../types";

/**
 * Insight Score — an explainable 0-100 measure of how strong a stock's
 * current signals are.
 *
 * Deliberately NOT a buy/sell recommendation. Every component is computed
 * from observable data and surfaced with its weight, so a user can audit
 * exactly why a number is what it is. The AI narrates these components; it
 * never produces the score itself.
 */

export interface ScoreComponent {
  key: "news" | "trend" | "momentum" | "stability";
  label: string;
  /** Component score, 0-100. */
  value: number;
  /** Weight in the composite, 0-1. */
  weight: number;
  /** value * weight — points contributed to the composite. */
  contribution: number;
  /** Plain-language reason, shown in the UI. */
  detail: string;
}

/** Bands describe SIGNAL STRENGTH, not an action to take. */
export type ScoreBand = "very strong" | "strong" | "mixed" | "weak" | "very weak";

export interface InsightScore {
  symbol: string;
  name: string;
  asOf: string;
  score: number;
  band: ScoreBand;
  components: ScoreComponent[];
}

export function bandFor(score: number): ScoreBand {
  if (score >= 80) return "very strong";
  if (score >= 60) return "strong";
  if (score >= 40) return "mixed";
  if (score >= 20) return "weak";
  return "very weak";
}

const WEIGHTS = { news: 0.3, trend: 0.3, momentum: 0.25, stability: 0.15 } as const;

const LABELS = {
  news: "News sentiment",
  trend: "Trend consistency",
  momentum: "Momentum",
  stability: "Price stability",
} as const;

const TREND_FRAMES: Timeframe[] = ["1W", "1M", "3M", "6M", "1Y"];

/** Map a percentage change onto 0-100, saturating at +/- cap. */
function pctToScore(pct: number, cap: number): number {
  const clamped = Math.max(-cap, Math.min(cap, pct));
  return round2(50 + (clamped / cap) * 50);
}

function newsScore(news: NewsItem[]): { value: number; detail: string } {
  if (news.length === 0) {
    return { value: 50, detail: "No notable news today — neutral by default." };
  }
  // Weight each item by its estimated impact; sentiment drives direction.
  let weighted = 0;
  let totalImpact = 0;
  for (const n of news) {
    const dir = n.sentiment === "positive" ? 1 : n.sentiment === "negative" ? -1 : 0;
    weighted += dir * n.impact;
    totalImpact += n.impact;
  }
  const norm = totalImpact > 0 ? weighted / totalImpact : 0;
  const pos = news.filter((n) => n.sentiment === "positive").length;
  const neg = news.filter((n) => n.sentiment === "negative").length;
  const detail =
    `${news.length} item${news.length > 1 ? "s" : ""} today` +
    (pos ? `, ${pos} positive` : "") +
    (neg ? `, ${neg} negative` : "") +
    `. Top: "${news[0].headline}"`;
  return { value: round2(50 + norm * 50), detail };
}

function trendScore(trends: Record<string, number>): { value: number; detail: string } {
  const ups = TREND_FRAMES.filter((t) => (trends[t] ?? 0) > 0).length;
  return {
    value: round2((ups / TREND_FRAMES.length) * 100),
    detail: `Higher on ${ups} of ${TREND_FRAMES.length} timeframes (1W, 1M, 3M, 6M, 1Y).`,
  };
}

function momentumScore(trends: Record<string, number>): { value: number; detail: string } {
  // Is the recent move faster or slower than the longer-term pace?
  const short = trends["1M"] ?? 0;
  const long = trends["6M"] ?? 0;
  const spread = short - long / 6; // 6M change normalised to a monthly pace
  return {
    value: pctToScore(spread, 10),
    detail: `1M change ${short >= 0 ? "+" : ""}${short.toFixed(1)}% is moving ${
      spread >= 0 ? "faster" : "slower"
    } than its 6-month pace.`,
  };
}

function stabilityScore(prices: number[]): { value: number; detail: string } {
  if (prices.length < 3) return { value: 50, detail: "Not enough history to measure stability." };
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    rets.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const dailyVol = Math.sqrt(variance) * 100; // percent
  // 0% daily vol -> 100; 4%+ daily vol -> 0.
  const value = round2(Math.max(0, Math.min(100, 100 - (dailyVol / 4) * 100)));
  return {
    value,
    detail: `Daily price swings average ${dailyVol.toFixed(2)}% — ${
      dailyVol < 1.2 ? "steady" : dailyVol < 2.5 ? "moderate" : "volatile"
    }.`,
  };
}

export function scoreStock(symbol: string, asOf: Date = new Date()): InsightScore | null {
  const info = getStockInfo(symbol);
  if (!info) return null;

  const quote = getQuote(info.symbol, asOf);
  const news = getNews(info.symbol, quote.changePct, asOf);
  const prices = getHistory(info.symbol, "6M", asOf).map((p) => p.price);

  const trends: Record<string, number> = {};
  for (const tf of TREND_FRAMES) {
    const h = getHistory(info.symbol, tf, asOf);
    trends[tf] = round2(((h[h.length - 1].price - h[0].price) / h[0].price) * 100);
  }

  const parts = {
    news: newsScore(news),
    trend: trendScore(trends),
    momentum: momentumScore(trends),
    stability: stabilityScore(prices),
  };

  const components: ScoreComponent[] = (Object.keys(parts) as (keyof typeof parts)[]).map((key) => ({
    key,
    label: LABELS[key],
    value: parts[key].value,
    weight: WEIGHTS[key],
    contribution: round2(parts[key].value * WEIGHTS[key]),
    detail: parts[key].detail,
  }));

  const score = round2(components.reduce((a, c) => a + c.contribution, 0));

  return {
    symbol: info.symbol,
    name: info.name,
    asOf: asOf.toISOString().slice(0, 10),
    score,
    band: bandFor(score),
    components,
  };
}
