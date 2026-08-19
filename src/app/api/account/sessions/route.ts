import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentSession, currentUser } from "@/lib/auth";
import { listSessions, revokeAllSessions, revokeSession } from "@/lib/db";
import { audit } from "@/lib/security";

export async function GET() {
  const user = await currentUser();
  const session = await currentSession();
  if (!user || !session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sessions: listSessions(user.id, session.jti) });
}

/** Revoke one session by jti, or every other session when `all` is set. */
export async function DELETE(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  const session = await currentSession();
  if (!user || !session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get("all") === "true") {
    const count = revokeAllSessions(user.id, session.jti);
    audit(user.id, "sessions.revoked_all", `${count} session(s)`, req);
    return NextResponse.json({ ok: true, revoked: count });
  }

  const jti = url.searchParams.get("jti");
  if (!jti) return NextResponse.json({ error: "jti or all=true required" }, { status: 400 });
  if (jti === session.jti) {
    return NextResponse.json({ error: "Use log out to end the current session." }, { status: 400 });
  }
  const ok = revokeSession(user.id, jti);
  if (ok) audit(user.id, "sessions.revoked_one", undefined, req);
  return NextResponse.json({ ok });
}
