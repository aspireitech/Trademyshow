import { expect, test } from "@playwright/test";

/**
 * End-to-end smoke test against the production build:
 * landing → register → create group → add stocks → digest.
 */
test("full user journey: signup to AI digest", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Landing
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("why");

  // Register
  await page.getByRole("link", { name: /Start .*free trial/ }).first().click();
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("password123");
  await page.getByRole("button", { name: "Sign up free" }).click();

  // Dashboard: create a group
  await expect(page.getByRole("heading", { name: "Your watchlists" })).toBeVisible();
  await page.getByPlaceholder(/New watchlist name/).fill("AI & Chips");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("heading", { name: "AI & Chips" }).click();

  // Group detail: add stocks via search
  for (const symbol of ["NVDA", "AMD"]) {
    await page.getByPlaceholder(/Search by symbol/).fill(symbol);
    await page.getByRole("button", { name: new RegExp(`\\+ ${symbol}`) }).click();
    await expect(page.locator("table.holdings")).toContainText(symbol);
  }

  // Timeframe tabs switch without errors
  await page.getByRole("button", { name: "1Y", exact: true }).click();
  await expect(page.locator("table.holdings")).toContainText("1Y");

  // Generate digest (template writer — no API key in e2e env)
  await page.getByRole("button", { name: "Generate digest" }).click();
  await expect(page.getByText(/AI & Chips/).first()).toBeVisible();
  await expect(page.getByText(/not investment advice/i)).toBeVisible({ timeout: 15_000 });

  // Individual stock analysis: drill in from the holdings table
  await page.getByRole("link", { name: "NVDA" }).click();
  await expect(page.getByRole("heading", { name: /NVDA/ })).toBeVisible();
  await expect(page.getByText("Every timeframe at a glance")).toBeVisible();
  await page.getByRole("button", { name: "Show 1Y chart" }).click();
  await expect(page.getByText(/over 1Y/)).toBeVisible();

  // New accounts are on a Pro trial, so a second watchlist is allowed.
  await page.getByRole("link", { name: "← Dashboard" }).click();
  await expect(page.getByText(/days of Pro left/)).toBeVisible();
  await page.getByPlaceholder(/New watchlist name/).fill("Second Watchlist");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Second Watchlist" })).toBeVisible();
});

test("look up any stock directly from the dashboard", async ({ page }) => {
  const email = `e2e-lookup-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Lookup Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("password123");
  await page.getByRole("button", { name: "Sign up free" }).click();

  // No group needed — search and open a single stock
  await page.getByPlaceholder(/Look up any stock/).fill("TSLA");
  await page.getByRole("button", { name: /TSLA/ }).click();
  await expect(page.getByRole("heading", { name: /TSLA/ })).toBeVisible();
  await expect(page.getByText(/not investment advice/i)).toBeVisible();
});
