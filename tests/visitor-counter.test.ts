/**
 * The visitor counters, and the gate in front of them.
 *
 * The gate is the part worth testing hardest: these are everyone's traffic
 * numbers in one line, and the requirement is that only an administrator ever
 * sees them — not "sees them by default", not "sees them unless you look at
 * the HTML".
 */
import { beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";

import { resetDbForTests, getDb } from "@/lib/db";
import { recordVisit, visitorStats } from "@/lib/visitors";

beforeEach(() => resetDbForTests());

function visit(ip: string, path = "/", when = new Date()): void {
  recordVisit(ip, "Mozilla/5.0 (test)", path, when);
}

describe("counting", () => {
  it("counts a first view as one unique visitor and one view", () => {
    visit("1.1.1.1");
    const s = visitorStats();
    expect(s.uniqueToday).toBe(1);
    expect(s.totalViews).toBe(1);
    expect(s.returningToday).toBe(0);
  });

  it("counts a second page from the same visitor as a view, not a visitor", () => {
    visit("1.1.1.1", "/");
    visit("1.1.1.1", "/stocks/AAPL");
    const s = visitorStats();
    expect(s.uniqueToday).toBe(1);
    expect(s.totalViews).toBe(2);
    expect(s.returningToday).toBe(1);
    expect(s.repeatVisitorDays).toBe(1);
  });

  it("separates two different visitors", () => {
    visit("1.1.1.1");
    visit("2.2.2.2");
    expect(visitorStats().uniqueToday).toBe(2);
  });

  it("counts the same person on two days as two visitor-days, and says so", () => {
    // Not a bug: the identifying hash is re-salted daily so it cannot be
    // linked across days, which is what stops this being a tracking system.
    // The cost is that all-time "unique" is really visitor-days, and the label
    // in the UI says visitor-days for that reason.
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    visit("1.1.1.1", "/", yesterday);
    visit("1.1.1.1", "/", today);

    const s = visitorStats(today);
    expect(s.uniqueVisitorDays).toBe(2);
    expect(s.activeDays).toBe(2);
    expect(s.uniqueToday).toBe(1);
  });

  it("reports zeroes rather than dividing by zero on a fresh install", () => {
    const s = visitorStats();
    expect(s.totalViews).toBe(0);
    expect(s.repeatRatePct).toBe(0);
  });

  it("stores no IP address, only a salted hash", () => {
    visit("203.0.113.9");
    const rows = getDb().prepare("SELECT visitor_id FROM visitors").all() as { visitor_id: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].visitor_id).not.toContain("203.0.113");
    expect(rows[0].visitor_id).toMatch(/^[0-9a-f]{32}$/);
  });

  it("truncates a long path rather than storing an unbounded string", () => {
    visit("1.1.1.1", `/stocks/${"A".repeat(500)}`);
    const row = getDb().prepare("SELECT last_path FROM visitors").get() as { last_path: string };
    expect(row.last_path.length).toBeLessThanOrEqual(120);
  });
});
