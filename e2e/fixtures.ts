import { test as base } from "@playwright/test";

/**
 * Every test gets its own client IP.
 *
 * Rate limits are per-address by design, and a suite that registers a dozen
 * accounts in a minute is precisely what they exist to stop. Varying the
 * address keeps the limiter switched on during tests, rather than adding an
 * environment flag that disables it — the kind of escape hatch that eventually
 * gets left open in production.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    const octet = () => 1 + Math.floor(Math.random() * 250);
    await context.setExtraHTTPHeaders({ "x-real-ip": `198.51.${octet()}.${octet()}` });
    await use(context);
  },
});

export { expect } from "@playwright/test";
