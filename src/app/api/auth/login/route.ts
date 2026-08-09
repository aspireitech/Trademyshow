import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }
  const user = getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "invalid email or password" }, { status: 401 });
  }
  await setSessionCookie(user.id);
  const { passwordHash: _omit, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
