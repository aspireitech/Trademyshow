import { getHistory, getQuote, getStockInfo, round2 } from "../marketdata";
import { getNews } from "../news";
import type {
  DigestFacts,
  DigestPeriod,
  Holding,
  HoldingSnapshot,
  NewsItem,
  Quote,
} from "../types";

/**
 * The digest engine turns raw holdings + quotes + news into structured
 * facts: what moved, by how much, and what each holding contributed to the
 * group's overall move. This is deliberately pure math — the AI writer only
 * narrates facts computed here, so the digest can never invent numbers.
 *
 * The same maths serves both cadences. A daily digest measures against the
 * previous close; a weekly digest measures against the price a week ago.
 * Only the baseline changes, so attribution stays consistent across both.
 */

export interface EngineInputs {
  groupName: string;
  period: DigestPeriod;
  holdings: Pick<Holding, "symbol" | "quantity">[];
  quotes: Map<string, Quote>;
  /** Price at the start of the period, per symbol. */
  baselines: Map<string, number>;
  newsBySymbol: Map<string, NewsItem[]>;
  asOf: Date;
}

export function buildDigestFacts(inputs: EngineInputs): DigestFacts {
  const { groupName, period, holdings, quotes, baselines, newsBySymbol, asOf } = inputs;

  const snapshots: HoldingSnapshot[] = [];
  let totalValue = 0;
  let totalBaseValue = 0;

  for (const h of holdings) {
    const symbol = h.symbol.toUpperCase();
    const q = quotes.get(symbol);
    const base = baselines.get(symbol);
    if (!q || base === undefined || base <= 0) continue;

    const info = getStockInfo(symbol);
    const value = q.price * h.quantity;
    const baseValue = base * h.quantity;
    totalValue += value;
    totalBaseValue += baseValue;

    snapshots.push({
      symbol: q.symbol,
      name: info?.name ?? q.symbol,
      sector: info?.sector ?? "Unknown",
      quantity: h.quantity,
      price: q.price,
      value: round2(value),
      changePct: round2(((q.price - base) / base) * 100),
      weight: 0, // filled below, once totalValue is known
      contributionPct: 0,
      news: newsBySymbol.get(symbol) ?? [],
    });
  }

  for (const s of snapshots) {
    s.weight = totalValue > 0 ? round4(s.value / totalValue) : 0;
    // Contribution = the holding's share of the portfolio at the START of the
    // period, times its own move. These sum to the portfolio's move.
    const baseValue = s.value / (1 + s.changePct / 100);
    const baseWeight = totalBaseValue > 0 ? baseValue / totalBaseValue : 0;
    s.contributionPct = round4(baseWeight * s.changePct);
  }

  const changePct =
    totalBaseValue > 0 ? round2(((totalValue - totalBaseValue) / totalBaseValue) * 100) : 0;

  const byChange = [...snapshots].sort((a, b) => b.changePct - a.changePct);
  const byAbsContribution = [...snapshots].sort(
    (a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct),
  );

  return {
    groupName,
    period,
    asOf: asOf.toISOString().slice(0, 10),
    totalValue: round2(totalValue),
    changePct,
    holdings: snapshots,
    topGainers: byChange.filter((s) => s.changePct > 0).slice(0, 3),
    topLosers: byChange
      .filter((s) => s.changePct < 0)
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, 3),
    topContributors: byAbsContribution.slice(0, 3),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Gather quotes, period baselines and news for holdings, then build facts. */
export function computeGroupFacts(
  groupName: string,
  holdings: Pick<Holding, "symbol" | "quantity">[],
  asOf: Date = new Date(),
  period: DigestPeriod = "daily",
): DigestFacts {
  const quotes = new Map<string, Quote>();
  const baselines = new Map<string, number>();
  const newsBySymbol = new Map<string, NewsItem[]>();

  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const q = getQuote(sym, asOf);
    quotes.set(sym, q);
    // Daily measures against yesterday's close; weekly against a week ago.
    baselines.set(sym, period === "weekly" ? getHistory(sym, "1W", asOf)[0].price : q.prevClose);
    newsBySymbol.set(sym, getNews(sym, q.changePct, asOf));
  }

  return buildDigestFacts({ groupName, period, holdings, quotes, baselines, newsBySymbol, asOf });
}
