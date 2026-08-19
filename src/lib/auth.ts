import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getUserById, isSessionActive, recordSession, revokeSession, touchSession } from "./db";
import { clientIp, hashIp } from "./security";
import type { User } from "./types";

const COOKIE_NAME = "tms_session";
const CSRF_COOKIE = "tms_csrf";
const SESSION_DAYS = 30;

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-not-for-production");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Every token carries a `jti` that is also recorded server-side. Verification
 * checks that row, so "log out everywhere" and single-session revocation
 * actually invalidate a token instead of merely deleting a cookie the attacker
 * no longer needs.
 */
export async function createSessionToken(userId: number, jti: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export interface VerifiedSession {
  userId: number;
  jti: string;
}

export async function verifySessionToken(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "number" || typeof payload.jti !== "string") return null;
    if (!isSessionActive(payload.jti)) return null;
    return { userId: payload.uid, jti: payload.jti };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: number, req?: Request): Promise<string> {
  const jti = crypto.randomUUID();
  recordSession(
    userId,
    jti,
    req?.headers.get("user-agent")?.slice(0, 200) ?? null,
    req ? hashIp(clientIp(req)) : null,
  );

  const token = await createSessionToken(userId, jti);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  // Double-submit CSRF token. Readable by script on purpose: the client must
  // echo it in a header, which a cross-site page cannot do.
  jar.set(CSRF_COOKIE, crypto.randomBytes(24).toString("base64url"), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return jti;
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session) revokeSession(session.userId, session.jti);
  }
  jar.delete(COOKIE_NAME);
  jar.delete(CSRF_COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await currentSession();
  if (!session) return null;
  return getUserById(session.userId);
}

export async function currentSession(): Promise<VerifiedSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (session) touchSession(session.jti);
  return session;
}

// ---------- CSRF ----------

/**
 * Double-submit cookie check for state-changing requests.
 *
 * SameSite=Lax already blocks cross-site POSTs in current browsers, but it is a
 * single control with known gaps (older browsers, some redirect flows), so the
 * header check backs it up. Requests carrying no session cookie at all are not
 * challenged: there is no session to ride.
 */
export async function assertCsrf(req: Request): Promise<boolean> {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const jar = await cookies();
  if (!jar.get(COOKIE_NAME)) return true;

  const cookieToken = jar.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) return false;

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function csrfFailed(): Response {
  return new Response(JSON.stringify({ error: "Invalid or missing CSRF token." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
