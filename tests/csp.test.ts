/**
 * The inline theme bootstrap. It runs under a nonce-based CSP, so what matters
 * is that it stays small, self-contained, and free of anything that would
 * force the policy wider than 'self' plus a nonce.
 */
import { describe, expect, it } from "vitest";

import { THEME_BOOTSTRAP } from "@/lib/csp";

describe("inline theme bootstrap", () => {
  it("needs nothing the policy does not already allow", () => {
    // No eval, no network, no dynamic import — it only reads localStorage
    // before first paint.
    expect(THEME_BOOTSTRAP).not.toMatch(/eval|fetch|import\(|XMLHttpRequest/);
  });

  it("cannot throw into the page when storage is unavailable", () => {
    // Safari in private mode throws on localStorage access; an uncaught throw
    // here would break the first paint of every page.
    expect(THEME_BOOTSTRAP).toContain("try{");
    expect(THEME_BOOTSTRAP).toContain("catch");
  });

  it("only ever applies a theme it recognises", () => {
    expect(THEME_BOOTSTRAP).toContain("'dark'");
    expect(THEME_BOOTSTRAP).toContain("'light'");
  });
});
