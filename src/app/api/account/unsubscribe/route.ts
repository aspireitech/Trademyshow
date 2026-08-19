import { NextResponse } from "next/server";
import { setEmailOptIn } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/tokens";
import { audit } from "@/lib/security";

/**
 * One-click unsubscribe. Deliberately requires no login: forcing someone to
 * sign in to stop emails is how you earn spam complaints.
 */
export async function POST(req: Request) {
  const token =
    new URL(req.url).searchParams.get("token") ??
    ((await req.json().catch(() => ({}))) as { token?: string }).token;

  const userId = token ? verifyUnsubscribeToken(token) : null;
  if (userId === null) {
    return NextResponse.json({ error: "That unsubscribe link is not valid." }, { status: 400 });
  }

  setEmailOptIn(userId, false);
  audit(userId, "email.unsubscribed", "one-click", req);
  return NextResponse.json({ ok: true });
}

/** RFC 8058 List-Unsubscribe=One-Click sends a POST; mail clients may probe GET. */
export const GET = POST;
