/**
 * CLI wrapper around seedSandbox(). The logic lives in src/lib/seed.ts so the
 * same seeding is reachable over HTTP on a deployed container, which has no
 * source tree to run this file from.
 */
import "./load-env";
import { seedSandbox } from "../src/lib/seed";
import { DEMO_ACCOUNT, DEMO_ADMIN } from "../src/lib/sandbox";
import { getDb } from "../src/lib/db";

async function main() {
  console.log("Seeding sandbox data…\n");
  const report = await seedSandbox();
  for (const line of report.log) console.log(`  · ${line}`);

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
