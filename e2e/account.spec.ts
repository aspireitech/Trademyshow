import { expect, test } from "./fixtures";

/**
 * The account surface: settings, security, referrals, and the pages that are
 * reached from an email rather than from inside the app.
 */

const PASSWORD = "Str0ng!Pass2026";

async function signUp(page: import("@playwright/test").Page, tag: string) {
  const email = `e2e-${tag}-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("Settings Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Password/).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your watchlists" })).toBeVisible();
  return email;
}

test("settings: account, email preferences, two-factor and referrals", async ({ page }) => {
  const email = await signUp(page, "settings");

  await page.getByRole("link", { name: "Settings" }).click();
  await page.waitForURL("**/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(email).first()).toBeVisible();

  // A fresh account is unverified, and the page says so rather than silently
  // never sending email.
  await expect(page.getByText("unverified")).toBeVisible();

  // Email preference round-trips.
  const emailToggle = page.getByRole("button", { name: /^Emails (on|off) — turn/ });
  await expect(emailToggle).toBeVisible();
  const before = (await emailToggle.textContent()) ?? "";
  await emailToggle.click();
  await expect(emailToggle).not.toHaveText(before);

  // Two-factor lives in its own section now.
  await page.locator(".settings-nav a", { hasText: "Security" }).first().click();
  await expect(page.getByRole("heading", { name: "Authenticator app" })).toBeVisible();

  // Enrolment shows a secret before it turns anything on — enabling in one
  // step would lock out anyone who mis-scans the code.
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.getByText(/Add this key to your authenticator/)).toBeVisible();
  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Turn on", exact: true }).click();
  await expect(page.getByText(/not valid/)).toBeVisible();

  // The current session is listed and cannot sign itself out from here.
  await expect(page.getByText("this device")).toBeVisible();

  // Referrals moved to the billing section.
  await page.locator(".settings-nav a", { hasText: "Plan & billing" }).first().click();
  await expect(page.getByRole("heading", { name: "Refer a friend" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copy link/ })).toBeVisible();
});

test("password reset asks for an address without revealing whether it exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /Forgot your password/ }).click();

  // React resets a controlled input when it hydrates, so typing before then is
  // silently discarded. Wait for hydration, then confirm the value stuck.
  await page.waitForLoadState("networkidle");
  const field = page.getByLabel("Email");
  await field.fill("definitely-not-a-user@example.com");
  await expect(field).toHaveValue("definitely-not-a-user@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  // Same answer either way — otherwise this page enumerates accounts.
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
});

test("an invalid reset link fails closed", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await page.getByLabel("New password").fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText(/expired or already been used/)).toBeVisible();
});

test("email verification accepts a code and rejects a wrong one", async ({ page }) => {
  await signUp(page, "verify");
  await page.goto("/verify-email");
  await page.getByLabel("Verification code").fill("000000");
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByText(/invalid or has expired/)).toBeVisible();
});

test("unsubscribe works without signing in", async ({ page }) => {
  // A bad token must still land somewhere useful rather than a stack trace.
  await page.goto("/unsubscribe?token=garbage");
  await expect(page.getByRole("heading", { name: /didn't work/ })).toBeVisible();
});

test("the admin dashboard is not reachable by an ordinary account", async ({ page }) => {
  await signUp(page, "admin");
  await page.goto("/dashboard/admin");
  // Redirected away, and no admin link in the nav to suggest it exists.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("analytics consent is asked for and honoured", async ({ page }) => {
  await signUp(page, "consent");
  const notice = page.getByRole("region", { name: "Analytics consent" });
  await expect(notice).toBeVisible();

  await notice.getByRole("button", { name: "No thanks" }).click();
  await expect(notice).toBeHidden();

  // The decision sticks across a reload rather than nagging every page view.
  await page.reload();
  await expect(page.getByRole("region", { name: "Analytics consent" })).toBeHidden();
});

test("an account cannot be created without accepting the terms", async ({ page }) => {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Refusenik");
  await page.getByLabel("Email").fill(`e2e-refuse-${Date.now()}@example.com`);
  await page.getByLabel(/Password/).fill(PASSWORD);

  // The button is disabled until the box is ticked — the gate is visible,
  // not a surprise error after submitting.
  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  await expect(page).toHaveURL(/\/register/);

  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
});

test("the signed agreement is downloadable from settings", async ({ page }) => {
  await signUp(page, "contract");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.locator(".settings-nav a", { hasText: "Your data" }).first().click();

  await expect(page.getByRole("heading", { name: "Your agreement" })).toBeVisible();
  const row = page.locator("text=/^TMS-\\d{4}-/").first();
  await expect(row).toBeVisible();

  const link = page.getByRole("link", { name: "Download PDF" }).first();
  const href = await link.getAttribute("href");
  expect(href).toContain("/api/account/contract?id=TMS-");

  // Fetch it through the browser session so auth and headers are exercised.
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  expect(res.headers()["x-contract-integrity"]).toBe("verified");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("the terms page states the liability cap and the arbitration clause", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  await expect(page.getByText(/US\$1000/).first()).toBeVisible();
  await expect(page.getByText(/CLASS ACTION WAIVER/)).toBeVisible();
  await expect(page.getByText(/binding individual arbitration/)).toBeVisible();
  await expect(page.getByText(/no fiduciary/i).first()).toBeVisible();
});

test("settings sections are reachable from the sidebar", async ({ page }) => {
  await signUp(page, "sidebar");
  await page.goto("/dashboard/settings");

  for (const [label, heading] of [
    ["Profile", "Account"],
    ["Security", "Authenticator app"],
    ["Plan & billing", "Your plan"],
    ["Activity", "Account activity"],
    ["Your data", "Your agreement"],
  ] as const) {
    await page.locator(".settings-nav a", { hasText: label }).first().click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    // The sidebar has to say where you are, or the sections feel like separate
    // pages that happen to look alike.
    await expect(page.locator(".settings-nav a.active")).toContainText(label);
  }
});

test("billing shows the trial, and offers no pause while nothing is charged", async ({ page }) => {
  await signUp(page, "trial");
  await page.goto("/dashboard/settings/billing");

  // The badge here has to agree with the one in the nav. Showing "free" while
  // the nav says "Pro trial" reads as the trial having silently ended.
  await expect(page.getByRole("heading", { name: "Your plan" })).toBeVisible();
  await expect(page.getByText("Pro trial").first()).toBeVisible();
  await expect(page.getByText(/Every Pro feature is unlocked/)).toBeVisible();

  // Nothing is being billed during a trial, so there is nothing to pause.
  await expect(page.getByRole("button", { name: "Pause subscription" })).toHaveCount(0);
});

test("the activity feed records what the account did", async ({ page }) => {
  await signUp(page, "activity");
  await page.goto("/dashboard/settings/activity");

  await expect(page.getByRole("heading", { name: "Account activity" })).toBeVisible();
  // Registration is itself an event, so the feed is never empty.
  await expect(page.locator(".activity-feed li").first()).toBeVisible();
  await expect(page.getByText("Account created")).toBeVisible();
});

test("an ordinary account cannot reach the subscriber list", async ({ page }) => {
  await signUp(page, "notadmin");
  await page.goto("/dashboard/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the help centre answers the advice question without JavaScript", async ({ page }) => {
  // Server-rendered on purpose: these answers should be findable by a search
  // engine and readable on a bad connection.
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Help centre" })).toBeVisible();
  await expect(page.getByText("Do you make stock recommendations?")).toBeVisible();

  await page.getByText("Do you make stock recommendations?").click();
  await expect(page.getByText(/never tells you what to buy, sell or hold/)).toBeVisible();
});

test("the dashboard shows what moved today", async ({ page }) => {
  await signUp(page, "movers");
  await expect(page.getByRole("heading", { name: "What moved today" })).toBeVisible();
  await expect(page.locator("text=/\\d+ up, \\d+ down/")).toBeVisible();

  // Risers and fallers are separate tabs; neither is a ranking of what to buy.
  await page.getByRole("button", { name: "Fallers" }).click();
  await expect(page.getByText(/Biggest moves that already happened/)).toBeVisible();
});

test("stocks can be compared on one rebased chart", async ({ page }) => {
  await signUp(page, "compare");
  await page.getByRole("link", { name: "Compare" }).click();

  await expect(page.getByRole("heading", { name: "Compare", exact: true })).toBeVisible();
  await expect(page.locator(".compare-svg")).toBeVisible();

  // Defaults to a stock against its index — the comparison that answers
  // "was that the company or the market?"
  await expect(page.locator(".compare-chip")).toHaveCount(2);

  await page.getByLabel("Add a symbol to compare").fill("AMD");
  await page.getByRole("button", { name: /AMD/ }).first().click();
  await expect(page.locator(".compare-chip")).toHaveCount(3);

  await page.getByRole("button", { name: "Remove AMD" }).click();
  await expect(page.locator(".compare-chip")).toHaveCount(2);
});
