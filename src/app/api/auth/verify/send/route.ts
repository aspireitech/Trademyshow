import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { issueToken } from "@/lib/tokens";
import { sendMail, verifyEmailTemplate } from "@/lib/mailer";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";
import { siteUrl } from "@/lib/site";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });

  const limit = limitRequest(req, "emailVerify", String(user.id));
  if (!limit.allowed) return tooManyRequests(limit);

  const { token, code } = issueToken(user.id, "verify_email");
  const mail = verifyEmailTemplate(user.name, `${siteUrl()}/verify-email?token=${token}`, code);
  await sendMail({ ...mail, to: user.email });
  audit(user.id, "email_verification.sent", undefined, req);

  return NextResponse.json({ ok: true });
}
