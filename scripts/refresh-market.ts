/**
 * Fill the market cache from the live feed.
 *
 *   npx tsx scripts/refresh-market.ts            quotes only
 *   npx tsx scripts/refresh-market.ts --history  quotes + five years of closes
 *
 * Run it once after install (with --history), then on a schedule — a cron
 * entry on Linux, a Scheduled Task on Windows — every few minutes during
 * market hours. The site reads the cache, never the vendor, so this is the
 * only process that needs outbound network access.
 */
import "./load-env";
import { refreshMarket, coverage, historyMissing } from "../src/lib/marketrefresh";
import { providerChoice } from "../src/lib/providers/feed";

async function main(): Promise<void> {
  const withHistory = process.argv.includes("--history") || historyMissing();

  console.log(`provider: ${providerChoice()}${withHistory ? " (pulling history too)" : ""}`);
  const summary = await refreshMarket({ withHistory });

  if (!summary.live) {
    console.log("MARKET_DATA_PROVIDER=mock — nothing fetched, the site stays on simulated data.");
    return;
  }

  console.log(
    `refreshed ${summary.refreshed}/${summary.attempted} in ${(summary.durationMs / 1000).toFixed(1)}s`,
  );
  for (const [vendor, n] of Object.entries(summary.vendors)) console.log(`  ${vendor}: ${n}`);
  for (const err of summary.errors) console.log(`  ! ${err}`);

  const cov = coverage();
  console.log(`coverage: ${cov.covered}/${cov.total} symbols carrying a real quote (${cov.pct}%)`);

  // A non-zero exit lets a scheduler notice a feed that has stopped working,
  // rather than quietly serving simulated prices for a week.
  if (summary.refreshed === 0) process.exitCode = 1;
}

void main();
