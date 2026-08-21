import type { Plan, PlanLimits, User } from "./types";

/**
 * Commercial model.
 *
 * Two paid tiers, not four. Long ladders look generous but split attention and
 * depress conversion; a clear "most people want this one" beats choice.
 * Annual is priced at ~2 months free, the standard SaaS anchor.
 *
 * Every new account starts on a 14-day Pro trial with no card required. The
 * product's value is a habit — it needs a couple of weeks of daily insights to
 * be felt at all, so a card-gated trial would filter out exactly the users who
 * would have converted.
 */

export const TRIAL_DAYS = 14;

/**
 * Days within which a charge is refunded on request, no questions asked.
 *
 * Offered because the objection this product has to overcome is "how do I know
 * the analysis is any good" — and a guarantee answers it more cheaply than any
 * amount of marketing copy. Deliberately not a permanent "discount": a price
 * that is always struck through is not a discount, it is a fake anchor, and
 * consumer regulators in the UK, EU and US all treat it as one.
 */
export const REFUND_DAYS = 30;

export interface PlanPricing {
  monthlyUsd: number;
  annualUsd: number;
  /** Percentage saved by paying annually. */
  annualSavingPct: number;
}

/**
 * What each tier includes, and why.
 *
 * The gating follows one rule: the free tier must prove the product, and every
 * paywall must sit at a moment of wanting rather than at the door. A visitor
 * who cannot see a single explained move never learns whether the analysis is
 * any good, and never converts.
 *
 * So free gets the whole promise at small scale — a real watchlist, a real
 * daily insight, the score's band and every timeframe. What it does not get is
 * the exact number behind the band. Seeing "mixed signals" and wanting to know
 * *why* is the strongest upgrade trigger this product has, and it arrives
 * after the value has been demonstrated rather than before.
 *
 * Pro then sells the habit: more lists, the weekly view, base rates, alerts,
 * and email delivery — the thing that turns a site you remember into a message
 * that arrives. Premium sells depth and workflow: per-holding analysis, export,
 * and headroom, which is what a heavier user asks for unprompted.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxGroups: 1,
    maxHoldingsPerGroup: 5,
    deepDigest: false,
    weeklyInsight: false,
    exactScore: false,
    expectations: false,
    emailDelivery: false,
    // Two lines answer "my stock versus the market", which is the question
    // most people arrive with. A fourth line is a power-user need.
    maxCompare: 2,
    // Three, not zero. An alert is the feature that brings someone back to the
    // site a week later, and a free tier that cannot set a single one never
    // earns the second visit. Three is enough to form the habit and few enough
    // that anyone tracking a real watchlist runs out.
    maxAlerts: 3,
    advancedMovers: false,
    csvExport: false,
  },
  pro: {
    maxGroups: 10,
    maxHoldingsPerGroup: 30,
    deepDigest: true,
    weeklyInsight: true,
    exactScore: true,
    expectations: true,
    emailDelivery: true,
    maxCompare: 4,
    maxAlerts: 20,
    advancedMovers: true,
    csvExport: false,
  },
  premium: {
    maxGroups: 100,
    maxHoldingsPerGroup: 100,
    deepDigest: true,
    weeklyInsight: true,
    exactScore: true,
    expectations: true,
    emailDelivery: true,
    maxCompare: 4,
    maxAlerts: 100,
    advancedMovers: true,
    csvExport: true,
  },
};

export const PLAN_PRICING: Record<Exclude<Plan, "free">, PlanPricing> = {
  pro: { monthlyUsd: 12, annualUsd: 120, annualSavingPct: 17 },
  premium: { monthlyUsd: 29, annualUsd: 290, annualSavingPct: 17 },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** True while the account is inside its no-card trial window. */
export function isTrialing(user: Pick<User, "plan" | "trialEndsAt">, now: Date = new Date()): boolean {
  if (user.plan !== "free" || !user.trialEndsAt) return false;
  return new Date(user.trialEndsAt).getTime() > now.getTime();
}

export function trialDaysRemaining(
  user: Pick<User, "plan" | "trialEndsAt">,
  now: Date = new Date(),
): number {
  if (!isTrialing(user, now)) return 0;
  const ms = new Date(user.trialEndsAt!).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * The plan whose limits actually apply right now. A trialing free account is
 * treated as Pro; when the trial lapses it silently returns to Free rather
 * than locking the user out of their own data.
 */
export function effectivePlan(
  user: Pick<User, "plan" | "trialEndsAt">,
  now: Date = new Date(),
): Plan {
  return isTrialing(user, now) ? "pro" : user.plan;
}

export function effectiveLimits(
  user: Pick<User, "plan" | "trialEndsAt">,
  now: Date = new Date(),
): PlanLimits {
  return limitsFor(effectivePlan(user, now));
}
