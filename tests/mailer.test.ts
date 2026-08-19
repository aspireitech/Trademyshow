/**
 * Email templates. These are the only strings a user sees before they trust us
 * with a password, so escaping and disclaimers get real tests.
 */
import { describe, expect, it } from "vitest";

import { digestTemplate, passwordResetTemplate, sendMail, verifyEmailTemplate } from "@/lib/mailer";

describe("sendMail", () => {
  it("falls back to the console when no provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_URL;
    // A reset link you cannot see in development is indistinguishable from
    // one that was never sent, so the fallback must succeed rather than error.
    const result = await sendMail({
      to: "dev@example.com",
      subject: "hello",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(result.ok).toBe(true);
  });
});

describe("verifyEmailTemplate", () => {
  const mail = verifyEmailTemplate("Ada", "https://example.com/verify-email?token=abc", "123456");

  it("carries the code in both the HTML and the plain-text part", () => {
    expect(mail.html).toContain("123456");
    expect(mail.text).toContain("123456");
  });

  it("states how long the code lasts", () => {
    expect(mail.text).toMatch(/30 minutes/);
  });
});

describe("passwordResetTemplate", () => {
  const mail = passwordResetTemplate("Ada", "https://example.com/reset-password?token=abc");

  it("links to the reset page", () => {
    expect(mail.html).toContain("https://example.com/reset-password?token=abc");
  });

  it("tells a recipient who did not request it that they need do nothing", () => {
    // Otherwise an unexpected reset email reads as a breach notice.
    expect(mail.text.toLowerCase()).toContain("ignore this email");
  });
});

describe("digestTemplate", () => {
  const mail = digestTemplate(
    "Ada",
    "Your watchlist held steady",
    "AAPL led the group.\n\nNVDA lagged.",
    "https://example.com/dashboard",
    "https://example.com/unsubscribe?token=1.abc",
  );

  it("uses the headline as the subject", () => {
    expect(mail.subject).toBe("Your watchlist held steady");
  });

  it("includes an unsubscribe link in both parts", () => {
    expect(mail.html).toContain("/unsubscribe?token=");
    expect(mail.text).toContain("/unsubscribe?token=");
  });

  it("keeps the not-advice disclaimer", () => {
    expect(mail.html.toLowerCase()).toContain("never investment advice");
  });

  it("escapes HTML in content rather than rendering it", () => {
    // Headlines come from an LLM and news feeds; neither is trusted markup.
    const hostile = digestTemplate(
      "Ada",
      '<img src=x onerror="alert(1)">',
      "body",
      "https://example.com/d",
      "https://example.com/u",
    );
    expect(hostile.html).not.toContain("<img src=x");
    expect(hostile.html).toContain("&lt;img");
  });
});
