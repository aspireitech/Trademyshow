import { describe, expect, it } from "vitest";
import {
  PLAN_LIMITS,
  PLAN_PRICING,
  TRIAL_DAYS,
  effectiveLimits,
  effectivePlan,
  isTrialing,
  limitsFor,
  trialDaysRemaining,
} from "@/lib/plans";
import { expectationFor } from "@/lib/insight/expectation";

const now = new Date("2026-08-19T12:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe("trial", () => {
  it("treats a free account inside its window as Pro", () => {
    const user = { plan: "free" as const, trialEndsAt: inDays(5) };
    expect(isTrialing(user, now)).toBe(true);
    expect(effectivePlan(user, now)).toBe("pro");
    expect(effectiveLimits(user, now).maxGroups).toBe(PLAN_LIMITS.pro.maxGroups);
  });

  it("drops back to Free when the window lapses, without losing access", () => {
    const user = { plan: "free" as const, trialEndsAt: inDays(-1) };
    expect(isTrialing(user, now)).toBe(false);
    expect(effectivePlan(user, now)).toBe("free");
    expect(effectiveLimits(user, now).maxGroups).toBe(PLAN_LIMITS.free.maxGroups);
  });

  it("counts remaining days, rounding up so the last day still shows", () => {
    expect(trialDaysRemaining({ plan: "free", trialEndsAt: inDays(13.2) }, now)).toBe(14);
    expect(trialDaysRemaining({ plan: "free", trialEndsAt: inDays(0.1) }, now)).toBe(1);
    expect(trialDaysRemaining({ plan: "free", trialEndsAt: inDays(-1) }, now)).toBe(0);
  });

  it("never applies a trial to an account that already pays", () => {
    const paying = { plan: "pro" as const, trialEndsAt: inDays(5) };
    expect(isTrialing(paying, now)).toBe(false);
    expect(effectivePlan(paying, now)).toBe("pro");
  });

  it("handles an account that never had a trial", () => {
    const user = { plan: "free" as const, trialEndsAt: null };
    expect(isTrialing(user, now)).toBe(false);
    expect(trialDaysRemaining(user, now)).toBe(0);
  });

  it("the trial length is a fortnight — long enough to form the habit", () => {
    expect(TRIAL_DAYS).toBe(14);
  });
});

describe("plan ladder", () => {
  it("each tier is a superset of the one below", () => {
    const [free, pro, premium] = [limitsFor("free"), limitsFor("pro"), limitsFor("premium")];
    expect(pro.maxGroups).toBeGreaterThan(free.maxGroups);
    expect(premium.maxGroups).toBeGreaterThanOrEqual(pro.maxGroups);
    expect(pro.maxHoldingsPerGroup).toBeGreaterThan(free.maxHoldingsPerGroup);
    for (const flag of ["weeklyInsight", "exactScore", "expectations", "emailDelivery"] as const) {
      expect(free[flag]).toBe(false);
      expect(pro[flag]).toBe(true);
      expect(premium[flag]).toBe(true);
    }
  });

  it("annual pricing is a genuine discount on twelve months", () => {
    for (const tier of ["pro", "premium"] as const) {
      const p = PLAN_PRICING[tier];
      expect(p.annualUsd).toBeLessThan(p.monthlyUsd * 12);
      const actualSaving = (1 - p.annualUsd / (p.monthlyUsd * 12)) * 100;
      // The advertised saving must not overstate the real one.
      expect(p.annualSavingPct).toBeLessThanOrEqual(Math.ceil(actualSaving));
    }
  });

  it("premium costs more than pro", () => {
    expect(PLAN_PRICING.premium.monthlyUsd).toBeGreaterThan(PLAN_PRICING.pro.monthlyUsd);
  });
});

describe("expectations are base rates, not forecasts", () => {
  it("reports a sample size alongside every figure", () => {
    const e = expectationFor("strong", 30, now);
    expect(e.samples).toBeGreaterThanOrEqual(0);
    expect(e.horizonDays).toBe(30);
    expect(e.summary.length).toBeGreaterThan(10);
  });

  it("refuses to quote a number when the history is too thin", () => {
    const e = expectationFor("very weak", 90, now);
    if (!e.reliable) {
      expect(e.summary).toMatch(/too few/i);
    } else {
      expect(e.samples).toBeGreaterThanOrEqual(20);
    }
  });

  it("phrases the summary as what happened, never what will happen", () => {
    for (const band of ["very strong", "strong", "mixed", "weak", "very weak"] as const) {
      const e = expectationFor(band, 30, now);
      expect(e.summary).not.toMatch(/will |expect to|going to|should rise|should fall/i);
    }
  });

  it("is deterministic for the same band, horizon and day", () => {
    expect(expectationFor("strong", 7, now)).toEqual(expectationFor("strong", 7, now));
  });
});
