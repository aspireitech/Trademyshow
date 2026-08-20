/**
 * Security headers.
 *
 * These are keyed off whether the request actually arrived over TLS, not off
 * NODE_ENV. Getting that wrong shipped a production build whose CSP rewrote
 * every stylesheet and script URL to https:// on an HTTP-only deployment —
 * the HTML arrived and nothing else did, so the site rendered as unstyled
 * text. It looked like a CSS bug and was a header bug.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// The bug being guarded against only exists in a production build, which is
// exactly why it never showed up in development.
beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
afterEach(() => vi.unstubAllEnvs());

function headersFor(url: string, extra: Record<string, string> = {}) {
  const res = middleware(new NextRequest(new Request(url, { headers: extra })));
  return {
    csp: res.headers.get("Content-Security-Policy") ?? "",
    hsts: res.headers.get("Strict-Transport-Security"),
    all: res.headers,
  };
}

describe("over plain HTTP", () => {
  it("does not upgrade subresource requests", () => {
    // The failure this prevents: a stylesheet at http://host/_next/... gets
    // fetched as https://host/_next/..., which nothing is listening for.
    const { csp } = headersFor("http://198.51.100.7/");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("does not assert HSTS from an origin that cannot serve TLS", () => {
    expect(headersFor("http://198.51.100.7/").hsts).toBeNull();
  });

  it("still applies the rest of the policy", () => {
    // Dropping TLS directives must not mean dropping the protection that does
    // not depend on TLS.
    const { csp, all } = headersFor("http://198.51.100.7/");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(all.get("X-Frame-Options")).toBe("DENY");
    expect(all.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("behind a TLS-terminating proxy", () => {
  it("trusts x-forwarded-proto over the request's own scheme", () => {
    // nginx talks to the app over http; the original scheme survives only here.
    const { csp, hsts } = headersFor("http://198.51.100.7/", { "x-forwarded-proto": "https" });
    expect(csp).toContain("upgrade-insecure-requests");
    expect(hsts).toContain("max-age=");
  });

  it("reads only the first entry of a chained x-forwarded-proto", () => {
    const { csp } = headersFor("http://198.51.100.7/", {
      "x-forwarded-proto": "https, http",
    });
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("stays in HTTP mode when the proxy reports http", () => {
    const { csp } = headersFor("http://198.51.100.7/", { "x-forwarded-proto": "http" });
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("in development", () => {
  it("never upgrades, so a local http server keeps working", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { csp } = headersFor("https://example.com/");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("'unsafe-eval'");
  });
});

describe("the policy itself", () => {
  it("issues a per-request nonce", () => {
    const a = headersFor("https://example.com/").csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
    const b = headersFor("https://example.com/").csp.match(/'nonce-([a-f0-9]+)'/)?.[1];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("allows same-origin styles and scripts", () => {
    // Next serves its bundles from the same origin; blocking 'self' here is
    // the other way to end up with an unstyled page.
    const { csp } = headersFor("https://example.com/");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });
});
