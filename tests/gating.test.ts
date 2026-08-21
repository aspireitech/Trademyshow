/**
 * Plan gating and visitor counting.
 *
 * The tiering follows one rule: free must prove the product, and every paywall
 * must sit at a moment of wanting rather than at the door. These tests encode
 * that rule so a later change to the limits is a deliberate act.
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.AUTH_SECRET = "test-secret-gating";

import { PLAN_LIMITS, effectiveLimits, limitsFor } from "@/lib/plans";
import { recordVisit, visitorStats } from "@/lib/visitors";
import { getDb, resetDbForTests } from "@/lib/db";

beforeEach(() => resetDbForTests());

describe("free tier proves the product", () => {
  const free = PLAN_LIMITS.free;

  it("includes a real watchlist and a real daily insight", () => {
    // A free tier that cannot explain a single move never demonstrates whether
    // the analysis is any good, and never converts.
    expect(free.maxGroups).toBeGreaterThanOrEqual(1);
    expect(free.maxHoldingsPerGroup).toBeGreaterThanOrEqual(5);
  });

  it("can compare a holding against its index", () => {
    // "My stock versus the market" is the question most visitors arrive with.
    expect(free.maxCompare).toBeGreaterThanOrEqual(2);
  });

  it("withholds the exact score, which is the upgrade trigger", () => {
    // Seeing "mixed signals" and wanting the number behind it is the strongest
    // moment of wanting this product has — and it lands after the value is
    // demonstrated, not before.
    expect(free.exactScore).toBe(false);
    expect(free.expectations).toBe(false);
  });

  it("withholds delivery, which is what turns a site into a habit", () => {
    expect(free.emailDelivery).toBe(false);
  });
});

describe("tiers increase monotonically", () => {
  it("never gives a cheaper plan more than a dearer one", () => {
    const order = ["free", "pro", "premium"] as const;
    const numeric = ["maxGroups", "maxHoldingsPerGroup", "maxCompare", "maxAlerts"] as const;
    for (let i = 1; i < order.length; i++) {
      for (const key of numeric) {
        expect(PLAN_LIMITS[order[i]][key]).toBeGreaterThanOrEqual(PLAN_LIMITS[order[i - 1]][key]);
      }
    }
  });

  it("never removes a boolean feature on upgrade", () => {
    const flags = ["deepDigest", "weeklyInsight", "exactScore", "expectations",
                   "emailDelivery", "advancedMovers", "csvExport"] as const;
    for (const key of flags) {
      if (PLAN_LIMITS.free[key]) expect(PLAN_LIMITS.pro[key]).toBe(true);
      if (PLAN_LIMITS.pro[key]) expect(PLAN_LIMITS.premium[key]).toBe(true);
    }
  });

  it("gives premium something pro does not have, or it is not worth its price", () => {
    const proToPremium =
      PLAN_LIMITS.premium.maxGroups > PLAN_LIMITS.pro.maxGroups ||
      PLAN_LIMITS.premium.csvExport !== PLAN_LIMITS.pro.csvExport ||
      PLAN_LIMITS.premium.maxAlerts > PLAN_LIMITS.pro.maxAlerts;
    expect(proToPremium).toBe(true);
  });
});

describe("trial gets paid limits", () => {
  it("treats a trialing account as pro", () => {
    const trialing = {
      plan: "free" as const,
      trialEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    expect(effectiveLimits(trialing).exactScore).toBe(true);
    expect(effectiveLimits(trialing).maxCompare).toBe(limitsFor("pro").maxCompare);
  });

  it("drops back to free when the trial has elapsed", () => {
    const expired = {
      plan: "free" as const,
      trialEndsAt: new Date(Date.now() - 86_400_000).toISOString(),
    };
    expect(effectiveLimits(expired).exactScore).toBe(false);
  });
});

describe("visitor counting", () => {
  const ip = "203.0.113.9";
  const ua = "Mozilla/5.0 test";

  it("counts a first visit as unique", () => {
    expect(recordVisit(ip, ua, "/").firstToday).toBe(true);
    expect(visitorStats().uniqueToday).toBe(1);
  });

  it("counts a second view from the same visitor as a return, not a new person", () => {
    recordVisit(ip, ua, "/");
    const second = recordVisit(ip, ua, "/pricing");
    expect(second.firstToday).toBe(false);
    expect(second.viewsToday).toBe(2);

    const stats = visitorStats();
    expect(stats.uniqueToday).toBe(1);
    expect(stats.returningToday).toBe(1);
  });

  it("separates different visitors", () => {
    recordVisit(ip, ua, "/");
    recordVisit("198.51.100.4", ua, "/");
    expect(visitorStats().uniqueToday).toBe(2);
  });

  it("cannot link the same visitor across days", () => {
    // The salt rotates with the date, so the identifier is unlinkable — this
    // counts engagement without being able to profile anyone.
    const today = new Date("2026-08-21T10:00:00Z");
    const tomorrow = new Date("2026-08-22T10:00:00Z");
    recordVisit(ip, ua, "/", today);
    expect(recordVisit(ip, ua, "/", tomorrow).firstToday).toBe(true);
  });

  it("stores no raw address", () => {
    recordVisit(ip, ua, "/");
    const row = getDb().prepare("SELECT visitor_id FROM visitors").get() as { visitor_id: string };
    expect(row.visitor_id).not.toContain("203.0.113");
    expect(row.visitor_id).toHaveLength(32);
  });

  it("reports zero rather than dividing by zero on an empty site", () => {
    expect(visitorStats().repeatRatePct).toBe(0);
  });
});
