import { NextResponse } from "next/server";
import { assertCsrf, clearSessionCookie, csrfFailed, currentUser, verifyPassword } from "@/lib/auth";
import { deleteUser, getUserByEmail } from "@/lib/db";
import { audit } from "@/lib/security";

/**
 * Permanent account deletion. Requires the current password — deletion is
 * irreversible, so a hijacked session must not be able to trigger it.
 */
export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { password, confirm } = (await req.json().catch(() => ({}))) as {
    password?: string;
    confirm?: string;
  };
  if (confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });
  }

  const record = getUserByEmail(user.email);
  if (!password || !record || !(await verifyPassword(password, record.passwordHash))) {
    return NextResponse.json({ error: "That password is not correct." }, { status: 403 });
  }

  // Logged before the row disappears; the audit entry survives with a null user.
  audit(user.id, "account.deleted", user.email, req);
  deleteUser(user.id);
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
