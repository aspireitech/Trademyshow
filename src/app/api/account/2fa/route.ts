import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { getTotpSecret, setTotpEnabled, setTotpSecret } from "@/lib/db";
import { generateRecoveryCodes, generateSecret, otpauthUrl, verifyCode } from "@/lib/totp";
import { audit } from "@/lib/security";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: Boolean(user.totpEnabledAt) });
}

/**
 * Two-step enrolment. "begin" issues a secret but leaves 2FA off; "enable"
 * turns it on only after the user proves the authenticator works. Enabling in
 * one step would lock out anyone who mis-scans the QR code.
 */
export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, code } = (await req.json().catch(() => ({}))) as {
    action?: string;
    code?: string;
  };

  if (action === "begin") {
    const secret = generateSecret();
    setTotpSecret(user.id, secret);
    return NextResponse.json({
      secret,
      otpauthUrl: otpauthUrl(secret, user.email),
    });
  }

  if (action === "enable") {
    const secret = getTotpSecret(user.id);
    if (!secret) return NextResponse.json({ error: "Start setup first." }, { status: 400 });
    if (!code || !verifyCode(secret, code)) {
      return NextResponse.json({ error: "That code is not valid. Check your authenticator." }, { status: 400 });
    }
    setTotpEnabled(user.id, true);
    audit(user.id, "2fa.enabled", undefined, req);
    return NextResponse.json({ ok: true, recoveryCodes: generateRecoveryCodes() });
  }

  if (action === "disable") {
    const secret = getTotpSecret(user.id);
    // Disabling is a security downgrade, so it needs a valid code too.
    if (!secret || !code || !verifyCode(secret, code)) {
      return NextResponse.json({ error: "Enter a current code to turn two-factor off." }, { status: 400 });
    }
    setTotpEnabled(user.id, false);
    setTotpSecret(user.id, null);
    audit(user.id, "2fa.disabled", undefined, req);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be begin, enable or disable" }, { status: 400 });
}
