export const TIMEFRAMES = ["1D", "1W", "1M", "3M", "6M", "1Y", "5Y", "YTD", "ALL"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export type Plan = "free" | "pro" | "premium";

export type UserRole = "user" | "admin";

export interface User {
  id: number;
  email: string;
  name: string;
  plan: Plan;
  role: UserRole;
  /** ISO timestamp; while in the future the account gets Pro limits. */
  trialEndsAt: string | null;
  emailVerifiedAt: string | null;
  totpEnabledAt: string | null;
  referralCode: string | null;
  emailOptIn: boolean;
  stripeCustomerId: string | null;
  lastDigestSentAt: string | null;
  /** When this account accepted the Terms, and which version. */
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  /** E.164, only set once verified by SMS code. */
  phone: string | null;
  phoneVerifiedAt: string | null;
  /** While in the future, billing and delivery are suspended. */
  pausedUntil: string | null;
  createdAt: string;
}

export interface UserSession {
  id: number;
  jti: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  current: boolean;
}

export interface Alert {
  id: number;
  userId: number;
  symbol: string;
  direction: "above" | "below";
  threshold: number;
  lastFiredAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
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

/** Broad instrument type. Absent means an ordinary listed equity. */
export type AssetClass = "stock" | "etf" | "crypto" | "index";

export interface StockInfo {
  symbol: string;
  name: string;
  sector: string;
  assetClass?: AssetClass;
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number; // change over the digest period, percent
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
  /** Link to the original article, when the provider supplies one. */
  url?: string;
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
  changePct: number;
  weight: number; // share of portfolio value, 0..1
  contributionPct: number; // baseline weight * changePct — what this holding did to the portfolio
  news: NewsItem[];
}

/** Structured facts handed to the digest writer (LLM or template). */
export type DigestPeriod = "daily" | "weekly";

export interface DigestFacts {
  groupName: string;
  period: DigestPeriod;
  asOf: string;
  totalValue: number;
  changePct: number;
  holdings: HoldingSnapshot[];
  topGainers: HoldingSnapshot[];
  topLosers: HoldingSnapshot[];
  topContributors: HoldingSnapshot[]; // by |contribution|
}

/** Which engine produced the digest prose: an LLM provider, or the fallback. */
export type DigestWriter = "gemini" | "anthropic" | "openai" | "template";

export interface Digest {
  id: number;
  groupId: number;
  asOf: string;
  headline: string;
  body: string;
  facts: DigestFacts;
  writer: DigestWriter;
  period: DigestPeriod;
  createdAt: string;
}

export interface PlanLimits {
  maxGroups: number;
  maxHoldingsPerGroup: number;
  /** Per-holding detail rather than just the top movers. */
  deepDigest: boolean;
  weeklyInsight: boolean;
  /** Free tier sees the band ("strong"), paid tiers see the exact number. */
  exactScore: boolean;
  /** Historical base rates for a score band. */
  expectations: boolean;
  emailDelivery: boolean;
  /** Instruments that can sit on one comparison chart. */
  maxCompare: number;
  /** Score-threshold alerts this account may keep. */
  maxAlerts: number;
  /** 52-week high/low and other screens beyond risers and fallers. */
  advancedMovers: boolean;
  csvExport: boolean;
}
