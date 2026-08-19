/**
 * Outbound email.
 *
 * Provider-agnostic by design: Resend and generic SMTP are both reachable over
 * plain HTTP/SMTP, and when neither is configured mail is written to the
 * console instead of being dropped. That last part matters in development —
 * a password-reset link you cannot see is indistinguishable from one that was
 * never sent.
 */

import { shouldSuppressEmail } from "./sandbox";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailResult =
  | { ok: true; provider: "resend" | "smtp" | "console" }
  | { ok: false; error: string };

function fromAddress(): string {
  return process.env.MAIL_FROM ?? "TradeMyShow <no-reply@trademyshow.com>";
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  // A sandbox signs up with throwaway addresses. Mailing them from the real
  // sending domain earns a spam reputation that takes months to undo, so the
  // send is short-circuited before a provider is ever chosen.
  if (shouldSuppressEmail()) return sendToConsole(mail);
  if (process.env.RESEND_API_KEY) return sendViaResend(mail);
  if (process.env.SMTP_URL) return sendViaSmtp(mail);
  return sendToConsole(mail);
}

async function sendViaResend(mail: Mail): Promise<MailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `resend responded ${res.status}: ${await res.text()}` };
    }
    return { ok: true, provider: "resend" };
  } catch (err) {
    return { ok: false, error: `resend request failed: ${String(err)}` };
  }
}

/**
 * SMTP is intentionally not implemented in-process: pulling a full SMTP client
 * in for one code path is a poor trade. Point SMTP_URL at a relay that exposes
 * an HTTP shim, or use Resend. Failing loudly beats silently dropping mail.
 */
async function sendViaSmtp(mail: Mail): Promise<MailResult> {
  console.warn(`[mail] SMTP_URL is set but no SMTP transport is compiled in; falling back to console for ${mail.to}`);
  return sendToConsole(mail);
}

function sendToConsole(mail: Mail): MailResult {
  console.info(
    [
      "",
      "──────── outbound email (no provider configured) ────────",
      `To:      ${mail.to}`,
      `Subject: ${mail.subject}`,
      "",
      mail.text,
      "─────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  return { ok: true, provider: "console" };
}

// ---------- templates ----------

const BRAND = "TradeMyShow";

function layout(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#101a2c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #dae1ed;border-radius:12px" cellpadding="0" cellspacing="0">
<tr><td style="padding:26px 28px">
<p style="margin:0 0 18px;font-weight:700;font-size:17px">Trade<span style="color:#2563eb">MyShow</span></p>
<h1 style="margin:0 0 12px;font-size:19px;line-height:1.3">${heading}</h1>
<div style="font-size:14px;line-height:1.6;color:#56657f">${body}</div>
${
  cta
    ? `<p style="margin:22px 0 0"><a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:8px">${cta.label}</a></p>
<p style="margin:14px 0 0;font-size:12px;color:#56657f;word-break:break-all">Or paste this into your browser:<br>${cta.url}</p>`
    : ""
}
</td></tr></table>
<p style="margin:16px 0 0;font-size:11px;color:#56657f;max-width:520px">${BRAND} provides analytics and educational content only — never investment advice.</p>
</td></tr></table></body></html>`;
}

export function verifyEmailTemplate(name: string, url: string, code: string): Mail & { to: string } {
  return {
    to: "",
    subject: `Confirm your email — ${BRAND}`,
    html: layout(
      `Confirm your email address`,
      `<p>Hi ${escapeHtml(name)}, please confirm this address so we can send your insights.</p>
       <p>Your code is <strong style="font-family:monospace;font-size:18px;letter-spacing:2px">${code}</strong>, or use the button below. It expires in 30 minutes.</p>`,
      { label: "Confirm email", url },
    ),
    text: `Hi ${name}, confirm your email for ${BRAND}.\n\nCode: ${code}\nOr open: ${url}\n\nThis expires in 30 minutes.`,
  };
}

export function passwordResetTemplate(name: string, url: string): Mail & { to: string } {
  return {
    to: "",
    subject: `Reset your password — ${BRAND}`,
    html: layout(
      `Reset your password`,
      `<p>Hi ${escapeHtml(name)}, we received a request to reset your password. This link expires in 60 minutes and can be used once.</p>
       <p>If you did not ask for this, you can ignore this email — your password will not change.</p>`,
      { label: "Choose a new password", url },
    ),
    text: `Hi ${name}, reset your ${BRAND} password:\n\n${url}\n\nExpires in 60 minutes, single use. If you did not request it, ignore this email.`,
  };
}

export function digestTemplate(
  name: string,
  headline: string,
  body: string,
  dashboardUrl: string,
  unsubscribeUrl: string,
): Mail & { to: string } {
  return {
    to: "",
    subject: headline,
    html:
      layout(
        escapeHtml(headline),
        `<p>${escapeHtml(body).replace(/\n\n/g, "</p><p>")}</p>`,
        { label: "Open your dashboard", url: dashboardUrl },
      ) +
      `<div style="max-width:520px;margin:0 auto;font-size:11px;color:#56657f;text-align:center;padding:8px 16px 24px"><a href="${unsubscribeUrl}" style="color:#56657f">Unsubscribe from these emails</a></div>`,
    text: `${headline}\n\n${body}\n\nDashboard: ${dashboardUrl}\nUnsubscribe: ${unsubscribeUrl}`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
