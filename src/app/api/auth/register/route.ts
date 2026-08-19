import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { TRIAL_DAYS } from "@/lib/plans";

export async function POST(req: Request) {
  const { email, name, password } = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
  };
  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, name and password are required" }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }
  if (getUserByEmail(email)) {
    return NextResponse.json({ error: "an account with this email already exists" }, { status: 409 });
  }
  // Every account starts on a no-card Pro trial.
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const user = createUser(email, name, await hashPassword(password), trialEndsAt);
  await setSessionCookie(user.id);
  return NextResponse.json({ user }, { status: 201 });
}
