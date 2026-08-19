import { devices } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Mobile audit. The failure this catches is horizontal page scroll: a wide
 * table or a fixed-width element pushing the body past the viewport, which
 * makes a page feel broken on a phone in a way desktop testing never reveals.
 */

// The iPhone descriptor defaults to WebKit; this suite runs on Chromium, so
// take the viewport, user agent and touch flags and keep the browser.
test.use({ ...devices["iPhone 13"], browserName: "chromium", defaultBrowserType: "chromium" });

const PUBLIC_PAGES = ["/", "/pricing", "/track-record", "/login", "/register", "/terms", "/privacy"];

for (const path of PUBLIC_PAGES) {
  test(`${path} fits the viewport on a phone`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // A couple of pixels is sub-pixel rounding; anything more is a real bug.
    expect(overflow).toBeLessThanOrEqual(2);
  });
}

test("the landing page's primary call to action is reachable and tappable", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: /Start .*free trial/ }).first();
  await expect(cta).toBeVisible();

  // Apple's 44px guidance — smaller targets get mis-tapped on a phone.
  const box = await cta.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});

test("the holdings table scrolls inside its own container, not the page", async ({ page }) => {
  const email = `e2e-mobile-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Mobile Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill("Str0ng!Pass2026");
  await page.getByRole("button", { name: "Sign up free" }).click();

  await page.getByPlaceholder(/New watchlist name/).fill("Phone list");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("heading", { name: "Phone list" }).click();

  await page.getByPlaceholder(/Search by symbol/).fill("NVDA");
  await page.getByRole("button", { name: /\+ NVDA/ }).click();
  await expect(page.locator("table.holdings")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
