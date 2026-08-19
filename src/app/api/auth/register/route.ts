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
import { recordAcceptance } from "@/lib/contracts";
import { hashIp, clientIp } from "@/lib/security";
import { TERMS_VERSION } from "@/lib/legal";

export async function POST(req: Request) {
  const limit = limitRequest(req, "register");
  if (!limit.allowed) return tooManyRequests(limit);

  const { email, name, password, ref, acceptTerms, termsVersion } = (await req
    .json()
    .catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
    ref?: string;
    acceptTerms?: boolean;
    termsVersion?: string;
  };
  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, name and password are required" }, { status: 400 });
  }
  // Acceptance is a precondition of the account existing, not a box ticked
  // afterwards. Refusing here is what makes the stored record meaningful:
  // there is no path to an account that did not pass through this check.
  if (acceptTerms !== true) {
    return NextResponse.json(
      { error: "You must accept the Terms of Service and Privacy Policy to create an account." },
      { status: 400 },
    );
  }
  // A stale tab could submit acceptance of superseded wording.
  if (termsVersion && termsVersion !== TERMS_VERSION) {
    return NextResponse.json(
      { error: "The Terms have been updated. Please reload the page and review them again." },
      { status: 409 },
    );
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

  // Render and store the executed agreement before the session exists, so the
  // record is written for every account without exception.
  const contract = recordAcceptance(user, {
    ipHash: hashIp(clientIp(req)),
    userAgent: req.headers.get("user-agent"),
  });

  await setSessionCookie(user.id, req);
  audit(user.id, "account.created", `terms ${TERMS_VERSION}${contract ? ` contract ${contract.contractId}` : ""}`, req);

  // Verification is sent immediately; the account works meanwhile, but email
  // delivery stays off until the address is confirmed.
  if (ref) attachReferral(user.id, ref);

  const { token, code } = issueToken(user.id, "verify_email");
  const mail = verifyEmailTemplate(name, `${siteUrl()}/verify-email?token=${token}`, code);
  await sendMail({ ...mail, to: user.email });

  return NextResponse.json({ user, contractId: contract?.contractId ?? null }, { status: 201 });
}
