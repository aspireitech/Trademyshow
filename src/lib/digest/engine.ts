import { getQuote, getStockInfo, round2 } from "../marketdata";
import { getNews } from "../news";
import type { DigestFacts, Holding, HoldingSnapshot, NewsItem, Quote } from "../types";

/**
 * The digest engine turns raw holdings + quotes + news into structured
 * facts: what moved, by how much, and what each holding contributed to the
 * group's overall move. This is deliberately pure math — the AI writer only
 * narrates facts computed here, so the digest can never invent numbers.
 */

export interface EngineInputs {
  groupName: string;
  holdings: Pick<Holding, "symbol" | "quantity">[];
  quotes: Map<string, Quote>;
  newsBySymbol: Map<string, NewsItem[]>;
  asOf: Date;
}

export function buildDigestFacts(inputs: EngineInputs): DigestFacts {
  const { groupName, holdings, quotes, newsBySymbol, asOf } = inputs;

  const snapshots: HoldingSnapshot[] = [];
  let totalValue = 0;
  let totalPrevValue = 0;

  for (const h of holdings) {
    const q = quotes.get(h.symbol.toUpperCase());
    if (!q) continue;
    const info = getStockInfo(h.symbol);
    const value = q.price * h.quantity;
    totalValue += value;
    totalPrevValue += q.prevClose * h.quantity;
    snapshots.push({
      symbol: q.symbol,
      name: info?.name ?? q.symbol,
      sector: info?.sector ?? "Unknown",
      quantity: h.quantity,
      price: q.price,
      value: round2(value),
      dayChangePct: q.changePct,
      weight: 0, // filled below once totalValue is known
      contributionPct: 0,
      news: newsBySymbol.get(q.symbol) ?? [],
    });
  }

  for (const s of snapshots) {
    s.weight = totalValue > 0 ? round4(s.value / totalValue) : 0;
    // Contribution: weight (by previous value) * holding's day move.
    const prevValue = (s.value / (1 + s.dayChangePct / 100));
    const prevWeight = totalPrevValue > 0 ? prevValue / totalPrevValue : 0;
    s.contributionPct = round4(prevWeight * s.dayChangePct);
  }

  const dayChangePct =
    totalPrevValue > 0 ? round2(((totalValue - totalPrevValue) / totalPrevValue) * 100) : 0;

  const byChange = [...snapshots].sort((a, b) => b.dayChangePct - a.dayChangePct);
  const byAbsContribution = [...snapshots].sort(
    (a, b) => Math.abs(b.contributionPct) - Math.abs(a.contributionPct),
  );

  return {
    groupName,
    asOf: asOf.toISOString().slice(0, 10),
    totalValue: round2(totalValue),
    dayChangePct,
    holdings: snapshots,
    topGainers: byChange.filter((s) => s.dayChangePct > 0).slice(0, 3),
    topLosers: byChange
      .filter((s) => s.dayChangePct < 0)
      .sort((a, b) => a.dayChangePct - b.dayChangePct)
      .slice(0, 3),
    topContributors: byAbsContribution.slice(0, 3),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Convenience wrapper: gather quotes + news for holdings, then build facts. */
export function computeGroupFacts(
  groupName: string,
  holdings: Pick<Holding, "symbol" | "quantity">[],
  asOf: Date = new Date(),
): DigestFacts {
  const quotes = new Map<string, Quote>();
  const newsBySymbol = new Map<string, ReturnType<typeof getNews>>();
  for (const h of holdings) {
    const sym = h.symbol.toUpperCase();
    const q = getQuote(sym, asOf);
    quotes.set(sym, q);
    newsBySymbol.set(sym, getNews(sym, q.changePct, asOf));
  }
  return buildDigestFacts({ groupName, holdings, quotes, newsBySymbol, asOf });
}
