import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { attachReferral } from "@/lib/billing";
import { createUser, getUserByEmail, markEmailVerified, setReferralCode } from "@/lib/db";
import { exchangeCode, verifyState, type OAuthProvider } from "@/lib/oauth";
import { TRIAL_DAYS } from "@/lib/plans";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";
import { siteUrl } from "@/lib/site";

function back(path: string): NextResponse {
  return NextResponse.redirect(`${siteUrl()}${path}`);
}

/**
 * Provider callback: verify state, exchange the code, then sign in or create
 * the account.
 *
 * An existing password account is linked by email only when the provider says
 * the address is verified — otherwise anyone able to assert an unverified
 * address at a provider could take over a TradeMyShow account.
 */
async function handle(req: Request, providerParam: string, code: string | null, state: string | null) {
  const limit = limitRequest(req, "login");
  if (!limit.allowed) return tooManyRequests(limit);

  const verified = verifyState(state);
  if (!verified || verified.provider !== providerParam) {
    audit(null, "oauth.bad_state", providerParam, req);
    return back("/login?error=oauth_state");
  }
  if (!code) return back("/login?error=oauth_cancelled");

  const identity = await exchangeCode(providerParam as OAuthProvider, code);
  if (!identity) {
    audit(null, "oauth.exchange_failed", providerParam, req);
    return back("/login?error=oauth_failed");
  }
  if (!identity.emailVerified) {
    audit(null, "oauth.unverified_email", providerParam, req);
    return back("/login?error=oauth_unverified");
  }

  const existing = getUserByEmail(identity.email);
  if (existing) {
    await setSessionCookie(existing.id, req);
    audit(existing.id, "login.oauth", providerParam, req);
    return back("/dashboard");
  }

  // A social signup has a provider-verified address and no password of its
  // own; the password field holds an unusable random hash so the password
  // login path can never match it.
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString();
  const user = createUser(
    identity.email,
    identity.name,
    `oauth:${crypto.randomBytes(24).toString("hex")}`,
    trialEndsAt,
  );
  setReferralCode(user.id, crypto.randomBytes(4).toString("hex").toUpperCase());
  markEmailVerified(user.id);
  if (verified.ref) attachReferral(user.id, verified.ref);

  await setSessionCookie(user.id, req);
  audit(user.id, "account.created.oauth", providerParam, req);
  return back("/dashboard");
}

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  return handle(req, provider, url.searchParams.get("code"), url.searchParams.get("state"));
}

/** Apple posts the callback as a form rather than a query string. */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const form = await req.formData();
  return handle(req, provider, String(form.get("code") ?? "") || null, String(form.get("state") ?? "") || null);
}
