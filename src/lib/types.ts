export const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "YTD", "ALL"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type Plan = "free" | "pro";

export interface User {
  id: number;
  email: string;
  name: string;
  plan: Plan;
  createdAt: string;
}

export interface Group {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
}

export interface Holding {
  id: number;
  groupId: number;
  symbol: string;
  quantity: number;
  addedAt: string;
}

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number; // day change, percent
}

export interface PricePoint {
  t: string; // ISO date or datetime
  price: number;
}

export interface NewsItem {
  id: string;
  symbol: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  sentiment: "positive" | "negative" | "neutral";
  impact: number; // 0..1 estimated relevance to price action
}

/** Per-holding analytics computed by the digest engine. */
export interface HoldingSnapshot {
  symbol: string;
  name: string;
  sector: string;
  quantity: number;
  price: number;
  value: number;
  dayChangePct: number;
  weight: number; // share of portfolio value, 0..1
  contributionPct: number; // weight * dayChangePct — what this holding did to the portfolio
  news: NewsItem[];
}

/** Structured facts handed to the digest writer (LLM or template). */
export interface DigestFacts {
  groupName: string;
  asOf: string;
  totalValue: number;
  dayChangePct: number;
  holdings: HoldingSnapshot[];
  topGainers: HoldingSnapshot[];
  topLosers: HoldingSnapshot[];
  topContributors: HoldingSnapshot[]; // by |contribution|
}

export interface Digest {
  id: number;
  groupId: number;
  asOf: string;
  headline: string;
  body: string;
  facts: DigestFacts;
  writer: "claude" | "template";
  createdAt: string;
}

export interface PlanLimits {
  maxGroups: number;
  maxHoldingsPerGroup: number;
  deepDigest: boolean;
}
