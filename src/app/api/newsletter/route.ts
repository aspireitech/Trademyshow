import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { limitRequest, tooManyRequests } from "@/lib/security";

/**
 * Newsletter sign-up.
 *
 * Deliberately not an account. Most people who want the market letter are not
 * ready to create a login, and making them do it converts a ten-second yes
 * into a decision — which is how a mailing list stays at zero. The address is
 * stored on its own, unconfirmed until they click the link in the first email,
 * and an unsubscribe is a single write.
 */

const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;

export async function POST(req: Request) {
  const limit = limitRequest(req, "register");
  if (!limit.allowed) return tooManyRequests(limit);

  const { email, source } = (await req.json().catch(() => ({}))) as {
    email?: string; source?: string;
  };
  const address = email?.trim().toLowerCase() ?? "";
  if (!EMAIL.test(address) || address.length > 200) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Re-subscribing after an unsubscribe is a deliberate act and must work:
  // the old row is revived rather than rejected as a duplicate.
  getDb()
    .prepare(
      "INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)\n" +
        "ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL, source = excluded.source",
    )
    .run(address, (source ?? "site").slice(0, 40));

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });
  getDb()
    .prepare("UPDATE newsletter_subscribers SET unsubscribed_at = datetime('now') WHERE email = ?")
    .run(email);
  // Always ok: telling a caller whether an address was on the list would turn
  // this into a membership oracle.
  return NextResponse.json({ ok: true });
}
