import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      /**
       * The application defaults to the live feed; the test suite must not.
       *
       * A unit test that reaches a vendor is slow, flaky and dependent on
       * somebody else's uptime — and on a machine with working DNS it would
       * quietly make real requests. Tests that exercise the live path set this
       * themselves, or delete it to get the production default back.
       */
      MARKET_DATA_PROVIDER: "mock",
    },
  },
});
