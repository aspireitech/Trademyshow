import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = getDb()
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50")
    .all(user.id) as { read_at: string | null }[];
  return NextResponse.json({
    notifications: rows,
    unread: rows.filter((r) => r.read_at === null).length,
  });
}

/** Mark one notification read, or all of them. */
export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  const db = getDb();
  if (id) {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?").run(id, user.id);
  } else {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
  }
  return NextResponse.json({ ok: true });
}
