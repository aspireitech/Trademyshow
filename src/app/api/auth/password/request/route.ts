import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { issueToken } from "@/lib/tokens";
import { passwordResetTemplate, sendMail } from "@/lib/mailer";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";
import { siteUrl } from "@/lib/site";

/**
 * Start a password reset.
 *
 * Always answers the same way whether or not the address exists — otherwise
 * this endpoint becomes a way to enumerate who has an account.
 */
export async function POST(req: Request) {
  const limit = limitRequest(req, "passwordReset");
  if (!limit.allowed) return tooManyRequests(limit);

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const generic = NextResponse.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
  if (!email) return generic;

  const user = getUserByEmail(email);
  if (!user) {
    audit(null, "password_reset.unknown_email", undefined, req);
    return generic;
  }

  const { token } = issueToken(user.id, "password_reset");
  const mail = passwordResetTemplate(user.name, `${siteUrl()}/reset-password?token=${token}`);
  await sendMail({ ...mail, to: user.email });
  audit(user.id, "password_reset.requested", undefined, req);

  return generic;
}
