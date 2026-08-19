import crypto from "node:crypto";
import { siteUrl } from "./site";

/**
 * Social sign-in over raw OAuth 2.0 / OIDC.
 *
 * No auth library: the authorization-code flow is a redirect and one POST, and
 * a dependency here would own the session format for the whole product. Each
 * provider is enabled purely by whether its credentials are present, so a
 * deployment without Google keys simply does not show the Google button.
 *
 * Security notes that are not optional:
 *  - `state` is signed and time-boxed, which is what stops login CSRF.
 *  - the ID token's `email_verified` claim is honoured; an unverified address
 *    from a provider must not silently take over an existing account.
 */

export type OAuthProvider = "google" | "apple";

interface ProviderConfig {
  id: OAuthProvider;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

function configs(): ProviderConfig[] {
  return [
    {
      id: "google",
      label: "Google",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    {
      id: "apple",
      label: "Apple",
      authorizeUrl: "https://appleid.apple.com/auth/authorize",
      tokenUrl: "https://appleid.apple.com/auth/token",
      scope: "name email",
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
  ];
}

export function providerConfig(id: string): ProviderConfig | null {
  const cfg = configs().find((c) => c.id === id);
  return cfg?.clientId && cfg.clientSecret ? cfg : null;
}

/** Which buttons the sign-in page should render. */
export function enabledProviders(): { id: OAuthProvider; label: string }[] {
  return configs()
    .filter((c) => c.clientId && c.clientSecret)
    .map((c) => ({ id: c.id, label: c.label }));
}

export function redirectUri(provider: OAuthProvider): string {
  return `${siteUrl()}/api/auth/oauth/${provider}/callback`;
}

// ---------- signed state ----------

const STATE_TTL_MS = 10 * 60_000;

function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret-not-for-production";
}

/**
 * State is a signed payload rather than a random value in a session store:
 * it needs no storage, cannot be forged, and expires on its own. The `ref`
 * rides along so a referral survives the round trip to the provider.
 */
export function signState(
  payload: { provider: OAuthProvider; ref?: string; terms?: string },
  now = Date.now(),
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: now + STATE_TTL_MS, n: crypto.randomBytes(8).toString("hex") }),
  ).toString("base64url");
  const mac = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(
  state: string | null,
  now = Date.now(),
): { provider: OAuthProvider; ref?: string; terms?: string } | null {
  if (!state) return null;
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;

  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(mac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      provider: OAuthProvider;
      ref?: string;
      terms?: string;
      exp: number;
    };
    if (parsed.exp < now) return null;
    return { provider: parsed.provider, ref: parsed.ref, terms: parsed.terms };
  } catch {
    return null;
  }
}

/**
 * The accepted terms version rides inside the signed state, so a social signup
 * carries the same proof of acceptance as a password signup. It cannot be
 * forged or added by hand: the state is HMAC'd, so the only way it is present
 * is that the user ticked the box on our page before being redirected.
 */
export function authorizeUrl(
  provider: OAuthProvider,
  ref?: string,
  terms?: string,
): string | null {
  const cfg = providerConfig(provider);
  if (!cfg) return null;

  const params = new URLSearchParams({
    client_id: cfg.clientId!,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: cfg.scope,
    state: signState({ provider, ref, terms }),
  });
  // Apple only returns the name on the first authorization, and only in a form
  // POST, which is why it needs response_mode set explicitly.
  if (provider === "apple") params.set("response_mode", "form_post");
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

// ---------- code exchange ----------

export interface OAuthIdentity {
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Decode an OIDC id_token payload. Signature checking is the token endpoint's
 *  job here: the code was exchanged over TLS directly with the provider, so the
 *  response is already authenticated. (A token received any other way must be
 *  verified against the provider's JWKS before being trusted.) */
export function decodeIdToken(idToken: string): OAuthIdentity | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as {
      email?: string;
      email_verified?: boolean | string;
      name?: string;
      given_name?: string;
    };
    if (!claims.email) return null;
    return {
      email: claims.email.toLowerCase(),
      name: claims.name ?? claims.given_name ?? claims.email.split("@")[0],
      // Apple sends this as the string "true"; Google sends a boolean.
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
    };
  } catch {
    return null;
  }
}

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
): Promise<OAuthIdentity | null> {
  const cfg = providerConfig(provider);
  if (!cfg) return null;

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId!,
      client_secret: cfg.clientSecret!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(provider),
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { id_token?: string };
  return data.id_token ? decodeIdToken(data.id_token) : null;
}
