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
  await page.getByRole("link", { name: "Get started" }).click();
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("password123");
  await page.getByRole("button", { name: "Sign up free" }).click();

  // Dashboard: create a group
  await expect(page.getByRole("heading", { name: "Your groups" })).toBeVisible();
  await page.getByPlaceholder(/New group name/).fill("AI & Chips");
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

  // Free plan gate: a second group must be rejected
  await page.getByRole("link", { name: "← All groups" }).click();
  await page.getByPlaceholder(/New group name/).fill("Second Group");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText(/Upgrade to Pro/i).first()).toBeVisible();
});
