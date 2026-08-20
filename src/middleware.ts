import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security headers on every response.
 *
 * CSP is the load-bearing one: it is what stops an injected script from
 * exfiltrating a session. 'unsafe-inline' remains for styles because the app
 * uses React inline style objects; scripts do not get that exemption.
 *
 * The nonce has to reach Next itself, not just our own inline script: the App
 * Router streams its RSC payload through inline `self.__next_f.push(...)`
 * scripts whose content differs per page, so no set of hashes can cover them.
 * Next reads the nonce out of the *request's* CSP header — setting only a
 * response header silently blocks every script in production while dev, which
 * allows 'unsafe-eval', keeps working. Hence the header is set on both.
 *
 * The cost is that pages render per request instead of being prerendered.
 * That is the accepted price of a nonce-based policy in the App Router; the
 * pages are cheap to render and most are per-user anyway.
 */
export function middleware(req: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV !== "production";

  /**
   * Whether THIS request arrived over TLS — not whether this is a production
   * build. The two are different, and conflating them breaks the page: over
   * plain HTTP, `upgrade-insecure-requests` rewrites every stylesheet and
   * script URL to https://, and on a deployment with no TLS listener every one
   * of those fetches fails. The HTML arrives and nothing else does.
   *
   * Behind nginx the original scheme only survives in x-forwarded-proto, which
   * is why that is checked before the request's own protocol.
   */
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isHttps = (forwardedProto ?? req.nextUrl.protocol.replace(":", "")) === "https";

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load the rest of the bundle
    // without each chunk needing its own nonce. Dev needs eval for fast refresh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    // Outbound calls: our own API plus the LLM and payment providers.
    "connect-src 'self' https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://api.stripe.com https://api.resend.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isHttps && !isDev ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  // Next parses the nonce out of this request header and stamps it on every
  // script tag it emits, inline payload scripts included.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (isHttps && !isDev) {
    // Two years, preload-eligible. Sent only on TLS: over plain HTTP browsers
    // ignore it anyway, and asserting it from an origin that cannot serve
    // HTTPS would lock users out the moment they believed it.
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return res;
}

export const config = {
  matcher: [
    // Everything except Next's own static output, which needs no headers.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
