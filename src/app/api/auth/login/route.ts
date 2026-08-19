import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";

export async function POST(req: Request) {
  // Limit by caller first, so a spray across many accounts is also throttled.
  const limit = limitRequest(req, "login");
  if (!limit.allowed) return tooManyRequests(limit);

  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    audit(user?.id ?? null, "login.failed", email, req);
    // Same message either way — distinguishing them leaks which emails exist.
    return NextResponse.json({ error: "invalid email or password" }, { status: 401 });
  }
  await setSessionCookie(user.id, req);
  audit(user.id, "login.succeeded", undefined, req);
  const { passwordHash: _omit, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
