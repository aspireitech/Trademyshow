/**
 * CLI wrapper around createPromo(). The logic lives in src/lib/billing.ts so
 * the same code-minting is reachable over HTTP on a deployed container
 * (POST /api/cron?job=promo&code=...&percent=...), which has no source tree
 * to run this file from — same split as scripts/seed.ts.
 *
 *   npx tsx scripts/create-promo.ts CODE PERCENT [maxRedemptions] [expiresAt]
 *   npx tsx scripts/create-promo.ts TESTFREE 100 50 2026-12-31
 */
import "./load-env";
import { checkPromo, createPromo } from "../src/lib/billing";

const [code, percentStr, maxStr, expiresAt] = process.argv.slice(2);

if (!code || !percentStr) {
  console.error("Usage: npx tsx scripts/create-promo.ts CODE PERCENT [maxRedemptions] [expiresAt]");
  console.error("Example: npx tsx scripts/create-promo.ts TESTFREE 100 50 2026-12-31");
  process.exit(1);
}

const percent = Number(percentStr);
if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
  console.error("PERCENT must be a number between 1 and 100.");
  process.exit(1);
}

const maxRedemptions = maxStr ? Number(maxStr) : undefined;

createPromo(code, percent, maxRedemptions, expiresAt);

const check = checkPromo(code);
console.log(`\nCreated ${code.toUpperCase()}: ${percent}% off` +
  (maxRedemptions ? `, max ${maxRedemptions} redemptions` : ", unlimited redemptions") +
  (expiresAt ? `, expires ${expiresAt}` : ", no expiry") + ".");
console.log(`Verified valid: ${check.valid}. Enter it at /dashboard/settings/billing.\n`);
