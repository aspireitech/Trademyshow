/**
 * Sandbox seeding. It runs against a deployed container over HTTP, so the
 * guard matters as much as the data.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.DB_PATH = ":memory:";
process.env.CONTRACTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tms-seed-"));

import { seedAllowed, seedSandbox } from "@/lib/seed";
import { getDb, getUserByEmail, resetDbForTests } from "@/lib/db";
import { DEMO_ACCOUNT, DEMO_ADMIN } from "@/lib/sandbox";

beforeEach(() => resetDbForTests());
afterEach(() => delete process.env.SANDBOX);

describe("seedAllowed", () => {
  it("refuses outside sandbox mode", () => {
    // These accounts have passwords printed on the landing page. Creating them
    // on a real deployment would be handing out an admin login.
    const guard = seedAllowed();
    expect(guard.allowed).toBe(false);
    expect(guard.reason).toMatch(/sandbox-only/i);
  });

  it("permits it in sandbox mode", () => {
    process.env.SANDBOX = "true";
    expect(seedAllowed().allowed).toBe(true);
  });
});

describe("seedSandbox", () => {
  it("creates the demo and admin accounts", async () => {
    const report = await seedSandbox();
    expect(report.usersCreated).toBe(2);
    expect(getUserByEmail(DEMO_ACCOUNT.email)).not.toBeNull();
    expect(getUserByEmail(DEMO_ADMIN.email)!.role).toBe("admin");
  });

  it("puts the demo account on a paid plan with a verified address", async () => {
    // Half a product behind an upgrade prompt is a poor demonstration, and an
    // unverified address would suppress the email digests.
    await seedSandbox();
    const demo = getUserByEmail(DEMO_ACCOUNT.email)!;
    expect(demo.plan).toBe("premium");
    expect(demo.emailVerifiedAt).not.toBeNull();
  });

  it("records an agreement for the seeded accounts like any other signup", async () => {
    await seedSandbox();
    const demo = getUserByEmail(DEMO_ACCOUNT.email)!;
    const n = getDb()
      .prepare("SELECT COUNT(*) AS n FROM contracts WHERE user_id = ?")
      .get(demo.id) as { n: number };
    expect(n.n).toBe(1);
  });

  it("creates watchlists with back-dated insights to render on first load", async () => {
    const report = await seedSandbox();
    expect(report.watchlistsCreated).toBe(3);
    expect(report.insightsWritten).toBeGreaterThan(30);

    const digests = getDb().prepare("SELECT COUNT(*) AS n FROM digests").get() as { n: number };
    expect(digests.n).toBe(report.insightsWritten);
  });

  it("is idempotent", async () => {
    await seedSandbox();
    const second = await seedSandbox();
    expect(second.usersCreated).toBe(0);
    expect(second.watchlistsCreated).toBe(0);
    expect(second.alreadyPresent).toBe(true);

    const groups = getDb().prepare("SELECT COUNT(*) AS n FROM groups").get() as { n: number };
    expect(groups.n).toBe(3);
  });
});
