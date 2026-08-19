import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/plans";
import { audit, checkPassword, limitRequest, tooManyRequests } from "@/lib/security";
import { issueToken } from "@/lib/tokens";
import { sendMail, verifyEmailTemplate } from "@/lib/mailer";
import { siteUrl } from "@/lib/site";
import crypto from "node:crypto";
import { setReferralCode } from "@/lib/db";
import { attachReferral } from "@/lib/billing";

export async function POST(req: Request) {
  const limit = limitRequest(req, "register");
  if (!limit.allowed) return tooManyRequests(limit);

  const { email, name, password, ref } = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
    ref?: string;
  };
  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, name and password are required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const strength = checkPassword(password, email);
  if (!strength.ok) {
    return NextResponse.json(
      { error: strength.problems.join(" "), problems: strength.problems },
      { status: 400 },
    );
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "an account with this email already exists" }, { status: 409 });
  }
  // Every account starts on a no-card Pro trial.
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const user = createUser(email, name, await hashPassword(password), trialEndsAt);
  setReferralCode(user.id, crypto.randomBytes(4).toString("hex").toUpperCase());
  await setSessionCookie(user.id, req);
  audit(user.id, "account.created", undefined, req);

  // Verification is sent immediately; the account works meanwhile, but email
  // delivery stays off until the address is confirmed.
  if (ref) attachReferral(user.id, ref);

  const { token, code } = issueToken(user.id, "verify_email");
  const mail = verifyEmailTemplate(name, `${siteUrl()}/verify-email?token=${token}`, code);
  await sendMail({ ...mail, to: user.email });

  return NextResponse.json({ user }, { status: 201 });
}
