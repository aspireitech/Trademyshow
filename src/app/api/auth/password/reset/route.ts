import { NextResponse } from "next/server";
import { getUserById, revokeAllSessions, setPasswordHash } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { consumeToken } from "@/lib/tokens";
import { audit, checkPassword, limitRequest, tooManyRequests } from "@/lib/security";

export async function POST(req: Request) {
  const limit = limitRequest(req, "passwordReset");
  if (!limit.allowed) return tooManyRequests(limit);

  const { token, password } = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  if (!token || !password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 });
  }

  const userId = consumeToken("password_reset", { token });
  if (userId === null) {
    return NextResponse.json(
      { error: "That reset link has expired or already been used. Request a new one." },
      { status: 400 },
    );
  }

  const user = getUserById(userId);
  const strength = checkPassword(password, user?.email);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.problems.join(" "), problems: strength.problems }, { status: 400 });
  }

  setPasswordHash(userId, await hashPassword(password));
  // A reset usually follows a compromise, so every existing session dies with it.
  const revoked = revokeAllSessions(userId);
  audit(userId, "password_reset.completed", `revoked ${revoked} session(s)`, req);

  return NextResponse.json({ ok: true, sessionsRevoked: revoked });
}
