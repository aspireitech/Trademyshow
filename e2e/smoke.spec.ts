import { expect, test } from "./fixtures";

/**
 * End-to-end smoke test against the production build:
 * landing → register → create group → add stocks → digest.
 */
test("full user journey: signup to AI digest", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Landing: the market board is the page now, not a pitch.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Markets today");
  await expect(page.locator("table.mkt-table tbody tr").first()).toBeVisible();

  // Register
  await page.getByRole("link", { name: /Start .*free trial/ }).first().click();
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("Str0ng!Pass2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();

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
  await page.getByRole("button", { name: "Show the 1Y chart" }).click();
  await expect(page.getByText(/over 1Y/)).toBeVisible();

  // Back out through the header, which every page now carries — the stock
  // page no longer needs a back link of its own.
  await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
  await expect(page.getByText(/days of Pro left/)).toBeVisible();
  await page.getByPlaceholder(/New watchlist name/).fill("Second Watchlist");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Second Watchlist" })).toBeVisible();
});

test("anyone can look up a stock from the header, signed in or not", async ({ page }) => {
  // No account, no group, no login wall. Someone who cannot look at a single
  // stock before signing up has no way to judge whether the analysis is good.
  await page.goto("/");
  await page.getByRole("combobox", { name: /Search for a company/ }).fill("TSLA");
  await page.getByRole("option", { name: /TSLA/ }).first().click();

  await expect(page).toHaveURL(/\/stocks\/TSLA/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TSLA");
  await expect(page.getByText(/not investment advice/i)).toBeVisible();

  // Every price says where it came from — that label is not optional.
  await expect(page.locator(".src-pill").first()).toBeVisible();
});

test("the whole ticker typed and Enter goes straight to that stock", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: /Search for a company/ });
  await box.fill("MSFT");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/stocks\/MSFT/);
});

test("keeping a stock asks a signed-out visitor for an account", async ({ page }) => {
  await page.goto("/stocks/NVDA");

  await page.getByRole("button", { name: /Watchlist/ }).click();
  const dialog = page.getByRole("dialog", { name: /Keep this stock/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: /Create a free account/ })).toBeVisible();
});

test("a signed-in visitor keeps a stock in one click", async ({ page }) => {
  const email = `e2e-watch-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Watch Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("Str0ng!Pass2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your watchlists" })).toBeVisible();

  await page.goto("/stocks/NVDA");
  await page.getByRole("button", { name: /Watchlist/ }).click();
  await expect(page.getByRole("button", { name: /On watchlist/ })).toBeVisible();
});

test("the old dashboard stock URL still resolves", async ({ page }) => {
  // Old digest emails and alert notifications point at it; a 404 there looks
  // like the stock was dropped.
  await page.goto("/dashboard/stocks/AAPL");
  await expect(page).toHaveURL(/\/stocks\/AAPL/);
});

test("the landing page shows a live board before any JavaScript runs", async ({ page }) => {
  // Server-rendered: this is the proof the product does something, so it has
  // to be in the HTML rather than appearing after hydration.
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => true });
  });
  await page.goto("/");

  const rows = page.locator(".mkt-table .board-row");
  await expect(rows.first()).toBeVisible();
  // A full screen, not a teaser: the gainers view fills up to 50 rows.
  expect(await rows.count()).toBeGreaterThanOrEqual(30);

  // Each row carries the three things the page claims to deliver.
  await expect(rows.first().locator(".board-change")).toBeVisible();
  await expect(rows.first().locator(".board-spark")).toBeAttached();
  await expect(page.locator(".board-band").first()).toBeVisible();

  // The reference indexes and the market screens are reachable from here.
  await expect(page.locator(".mkt-index").first()).toBeVisible();
  await page.getByRole("link", { name: "Top losers" }).first().click();
  await expect(page).toHaveURL(/markets\/losers/);
  await expect(page.locator(".mkt-table .board-row .loss").first()).toBeVisible();

  await expect(page.getByText(/never a list of what to buy/)).toBeVisible();
});

test("the signup prompt appears only after a few pages, and stays dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".signup-prompt")).toHaveCount(0);

  await page.goto("/pricing");
  await expect(page.locator(".signup-prompt")).toHaveCount(0);

  // Third distinct page — the visitor has chosen to look around by now, which
  // is the difference between an offer and an interruption.
  await page.goto("/track-record");
  await expect(page.locator(".signup-prompt")).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator(".signup-prompt")).toHaveCount(0);

  await page.goto("/help");
  await expect(page.locator(".signup-prompt")).toHaveCount(0);
});
