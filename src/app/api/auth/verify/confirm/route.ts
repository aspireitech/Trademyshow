import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { markEmailVerified } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";

/** Accepts either the emailed link token or the six-digit code. */
export async function POST(req: Request) {
  const limit = limitRequest(req, "emailVerify");
  if (!limit.allowed) return tooManyRequests(limit);

  const { token, code } = (await req.json().catch(() => ({}))) as {
    token?: string;
    code?: string;
  };

  let userId: number | null = null;
  if (token) {
    userId = consumeToken("verify_email", { token });
  } else if (code) {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    userId = consumeToken("verify_email", { code, userId: user.id });
  }

  if (userId === null) {
    return NextResponse.json({ error: "That code or link is invalid or has expired." }, { status: 400 });
  }

  markEmailVerified(userId);
  audit(userId, "email_verification.confirmed", undefined, req);
  return NextResponse.json({ ok: true });
}
