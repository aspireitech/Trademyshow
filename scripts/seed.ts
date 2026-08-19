/**
 * Seed a sandbox with data worth looking at.
 *
 * An empty demo is a bad demo: the whole product is explanation of movement,
 * and there is nothing to explain in an account with no holdings. This creates
 * two accounts and back-dates a fortnight of insights so the dashboard, the
 * digests and the track record all have something real to render on first load.
 *
 * Idempotent — running it twice does not duplicate anything.
 */
import { hashPassword } from "../src/lib/auth";
import { recordAcceptance } from "../src/lib/contracts";
import {
  addHolding, createGroup, createUser, getDb, getUserByEmail,
  listHoldings, saveDigest, setEmailOptIn, setReferralCode, setUserPlan,
} from "../src/lib/db";
import { computeGroupFacts } from "../src/lib/digest/engine";
import { writeWithTemplate } from "../src/lib/digest/writer";
import { DEMO_ACCOUNT, DEMO_ADMIN } from "../src/lib/sandbox";
import type { DigestPeriod } from "../src/lib/types";

const WATCHLISTS: { name: string; holdings: [string, number][] }[] = [
  {
    name: "Core holdings",
    holdings: [["AAPL", 40], ["MSFT", 25], ["SPY", 60], ["VTI", 30]],
  },
  {
    name: "AI & Chips",
    holdings: [["NVDA", 30], ["AMD", 45], ["TSM", 50], ["SMH", 20]],
  },
  {
    name: "Income & ballast",
    holdings: [["KO", 80], ["PG", 35], ["AGG", 100], ["GLD", 15]],
  },
];

async function ensureUser(
  email: string, name: string, password: string, role: "user" | "admin",
) {
  const existing = getUserByEmail(email);
  if (existing) {
    console.log(`  · ${email} already exists (id ${existing.id})`);
    return existing;
  }
  // A demo account skips the trial and sits on a paid plan, so every feature
  // is visible rather than half of it being an upgrade prompt.
  const user = createUser(email, name, await hashPassword(password), null);
  setUserPlan(user.id, "premium");
  setEmailOptIn(user.id, true);
  setReferralCode(user.id, role === "admin" ? "ADMIN01" : "DEMO2026");
  getDb()
    .prepare("UPDATE users SET role = ?, email_verified_at = datetime('now') WHERE id = ?")
    .run(role, user.id);
  recordAcceptance(user);
  console.log(`  ✓ created ${email} (id ${user.id}, ${role})`);
  return getUserByEmail(email)!;
}

async function main() {
  console.log("Seeding sandbox data…\n");

  const demo = await ensureUser(DEMO_ACCOUNT.email, "Demo User", DEMO_ACCOUNT.password, "user");
  await ensureUser(DEMO_ADMIN.email, "Sandbox Admin", DEMO_ADMIN.password, "admin");

  const existingGroups = getDb()
    .prepare("SELECT name FROM groups WHERE user_id = ?")
    .all(demo.id) as { name: string }[];
  const have = new Set(existingGroups.map((g) => g.name));

  for (const spec of WATCHLISTS) {
    if (have.has(spec.name)) {
      console.log(`  · watchlist "${spec.name}" already present`);
      continue;
    }
    const group = createGroup(demo.id, spec.name);
    for (const [symbol, qty] of spec.holdings) addHolding(group.id, symbol, qty);
    console.log(`  ✓ watchlist "${spec.name}" with ${spec.holdings.length} holdings`);

    // Back-date insights so the history and track record are populated on the
    // first page load rather than after a fortnight of waiting.
    const holdings = listHoldings(group.id);
    let written = 0;
    for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
      const asOf = new Date(Date.now() - daysAgo * 86_400_000);
      const isWeekend = [0, 6].includes(asOf.getUTCDay());
      const periods: DigestPeriod[] = isWeekend ? ["weekly"] : ["daily"];
      for (const period of periods) {
        const facts = computeGroupFacts(spec.name, holdings, asOf, period);
        const digest = writeWithTemplate(facts, true);
        saveDigest(group.id, facts.asOf, digest.headline, digest.body, facts, "template", period);
        written++;
      }
    }
    console.log(`    ↳ ${written} back-dated insights`);
  }

  const counts = getDb()
    .prepare(
      "SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM groups) AS groups, " +
        "(SELECT COUNT(*) FROM holdings) AS holdings, (SELECT COUNT(*) FROM digests) AS digests",
    )
    .get() as Record<string, number>;

  console.log(
    `\nDone. ${counts.users} users, ${counts.groups} watchlists, ` +
      `${counts.holdings} holdings, ${counts.digests} insights.`,
  );
  console.log(`\nSign in as: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`);
  console.log(`Admin view:  ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}\n`);
}

void main();
