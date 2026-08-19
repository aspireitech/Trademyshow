/**
 * Sandbox mode.
 *
 * A deployment anyone can click through without real money, real market-data
 * licences, or real email leaving the building. Every external side effect is
 * either stubbed or loud, and the UI says plainly that it is a demonstration —
 * an unlabelled demo showing invented prices is how someone ends up trading on
 * numbers we made up.
 *
 * The flag is read from the environment rather than inferred from NODE_ENV,
 * because a sandbox is a production build. It is `SANDBOX=true` or it is not.
 */

export function isSandbox(): boolean {
  return process.env.SANDBOX === "true";
}

/** Credentials shown on the sandbox landing banner. */
export const DEMO_ACCOUNT = {
  email: "demo@trademyshow.com",
  password: "Sandbox!Demo2026",
} as const;

export const DEMO_ADMIN = {
  email: "admin@trademyshow.com",
  password: "Sandbox!Admin2026",
} as const;

export interface SandboxGuard {
  allowed: boolean;
  reason?: string;
}

/**
 * Things that must not happen in a sandbox even if configured by accident —
 * a stray live Stripe key in a demo environment would charge a real card.
 */
export function guardExternalCharge(): SandboxGuard {
  if (!isSandbox()) return { allowed: true };
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) {
    return {
      allowed: false,
      reason: "Refusing to use a live Stripe key in sandbox mode. Use a sk_test_ key.",
    };
  }
  return { allowed: true };
}

/**
 * Outbound email in a sandbox goes to the console unless explicitly allowed.
 * Demo signups use throwaway addresses, and mailing them from a real domain is
 * a fast way to earn a spam reputation you cannot undo.
 */
export function shouldSuppressEmail(): boolean {
  return isSandbox() && process.env.SANDBOX_ALLOW_EMAIL !== "true";
}

export interface SandboxNotice {
  title: string;
  body: string;
  demo: { email: string; password: string };
}

export function sandboxNotice(): SandboxNotice {
  return {
    title: "Sandbox — demonstration only",
    body:
      "Prices and headlines on this deployment are generated, not real market data. " +
      "Payments run in Stripe test mode and no card is charged. Do not make any financial " +
      "decision based on anything shown here.",
    demo: { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password },
  };
}
