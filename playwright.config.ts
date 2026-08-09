import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3111",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: "npx next start -p 3111",
    url: "http://localhost:3111",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DB_PATH: "./data/e2e-test.db",
      AUTH_SECRET: "e2e-test-secret",
    },
  },
});
