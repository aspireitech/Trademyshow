import { hashPassword } from "./auth";
import { recordAcceptance } from "./contracts";
import {
  addHolding, createGroup, createUser, getDb, getUserByEmail,
  listHoldings, saveDigest, setEmailOptIn, setReferralCode, setUserPlan,
} from "./db";
import { computeGroupFacts } from "./digest/engine";
import { writeWithTemplate } from "./digest/writer";
import { DEMO_ACCOUNT, DEMO_ADMIN, isSandbox } from "./sandbox";
import type { DigestPeriod } from "./types";

/**
 * Sandbox seed data.
 *
 * Lives in lib rather than in the script so it can also be triggered over HTTP.
 * The deployed container carries only Next's standalone output — no `src`, no
 * tsx — so a CLI-only seeder would be unusable on exactly the deployments that
 * need it most.
 *
 * Idempotent: running it twice adds nothing.
 */

const WATCHLISTS: { name: string; holdings: [string, number][] }[] = [
  { name: "Core holdings", holdings: [["AAPL", 40], ["MSFT", 25], ["SPY", 60], ["VTI", 30]] },
  { name: "AI & Chips", holdings: [["NVDA", 30], ["AMD", 45], ["TSM", 50], ["SMH", 20]] },
  { name: "Income & ballast", holdings: [["KO", 80], ["PG", 35], ["AGG", 100], ["GLD", 15]] },
];

export interface SeedReport {
  usersCreated: number;
  watchlistsCreated: number;
  insightsWritten: number;
  alreadyPresent: boolean;
  log: string[];
}

async function ensureUser(
  email: string, name: string, password: string, role: "user" | "admin", log: string[],
) {
  const existing = getUserByEmail(email);
  if (existing) {
    log.push(`${email} already exists (id ${existing.id})`);
    return { user: existing, created: false };
  }
  // Demo accounts skip the trial and sit on a paid plan so every feature is
  // visible, rather than half the product being an upgrade prompt.
  const user = createUser(email, name, await hashPassword(password), null);
  setUserPlan(user.id, "premium");
  setEmailOptIn(user.id, true);
  setReferralCode(user.id, role === "admin" ? "ADMIN01" : "DEMO2026");
  getDb()
    .prepare("UPDATE users SET role = ?, email_verified_at = datetime('now') WHERE id = ?")
    .run(role, user.id);
  recordAcceptance(user);
  log.push(`created ${email} (id ${user.id}, ${role})`);
  return { user: getUserByEmail(email)!, created: true };
}

export async function seedSandbox(now: Date = new Date()): Promise<SeedReport> {
  const log: string[] = [];
  const report: SeedReport = {
    usersCreated: 0, watchlistsCreated: 0, insightsWritten: 0, alreadyPresent: false, log,
  };

  const demo = await ensureUser(DEMO_ACCOUNT.email, "Demo User", DEMO_ACCOUNT.password, "user", log);
  const admin = await ensureUser(DEMO_ADMIN.email, "Sandbox Admin", DEMO_ADMIN.password, "admin", log);
  report.usersCreated = Number(demo.created) + Number(admin.created);

  const have = new Set(
    (getDb().prepare("SELECT name FROM groups WHERE user_id = ?").all(demo.user.id) as {
      name: string;
    }[]).map((g) => g.name),
  );

  for (const spec of WATCHLISTS) {
    if (have.has(spec.name)) {
      log.push(`watchlist "${spec.name}" already present`);
      continue;
    }
    const group = createGroup(demo.user.id, spec.name);
    for (const [symbol, qty] of spec.holdings) addHolding(group.id, symbol, qty);
    report.watchlistsCreated++;

    // Back-date a fortnight so the dashboard, the digests and the track record
    // all have something to render on first load. An empty demo of a product
    // that explains movement has nothing to explain.
    const holdings = listHoldings(group.id);
    for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
      const asOf = new Date(now.getTime() - daysAgo * 86_400_000);
      const period: DigestPeriod = [0, 6].includes(asOf.getUTCDay()) ? "weekly" : "daily";
      const facts = computeGroupFacts(spec.name, holdings, asOf, period);
      const digest = writeWithTemplate(facts, true);
      saveDigest(group.id, facts.asOf, digest.headline, digest.body, facts, "template", period);
      report.insightsWritten++;
    }
    log.push(`watchlist "${spec.name}" with ${spec.holdings.length} holdings`);
  }

  report.alreadyPresent =
    report.usersCreated === 0 && report.watchlistsCreated === 0;
  return report;
}

/** Refuses outside sandbox mode — this creates accounts with published passwords. */
export function seedAllowed(): { allowed: boolean; reason?: string } {
  if (!isSandbox()) {
    return {
      allowed: false,
      reason: "Seeding is sandbox-only: it creates accounts whose passwords are public.",
    };
  }
  return { allowed: true };
}
