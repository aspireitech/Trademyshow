import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { setEmailOptIn } from "@/lib/db";
import { audit } from "@/lib/security";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ emailOptIn: user.emailOptIn });
}

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { emailOptIn } = (await req.json().catch(() => ({}))) as { emailOptIn?: boolean };
  if (typeof emailOptIn !== "boolean") {
    return NextResponse.json({ error: "emailOptIn must be true or false" }, { status: 400 });
  }
  setEmailOptIn(user.id, emailOptIn);
  audit(user.id, emailOptIn ? "email.opted_in" : "email.opted_out", undefined, req);
  return NextResponse.json({ ok: true, emailOptIn });
}
