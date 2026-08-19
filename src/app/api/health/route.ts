import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { anyProviderConfigured } from "@/lib/llm";
import { stripeConfigured } from "@/lib/billing";
import { unresolvedLegalPlaceholders } from "@/lib/legal";
import { enabledProviders } from "@/lib/oauth";
import { isSandbox } from "@/lib/sandbox";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness in one endpoint.
 *
 * Deliberately unauthenticated but deliberately boring: it reports which
 * subsystems are configured, never their credentials. A load balancer needs
 * the status code; a human deploying needs the checklist, which is why the
 * warnings are spelled out rather than left as a boolean.
 */
export async function GET() {
  const checks: Record<string, boolean> = {};
  const warnings: string[] = [];

  try {
    getDb().prepare("SELECT 1").get();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  checks.aiConfigured = anyProviderConfigured();
  if (!checks.aiConfigured) {
    warnings.push("No LLM provider configured — insights use the deterministic template writer.");
  }

  checks.stripeConfigured = stripeConfigured();
  if (!checks.stripeConfigured) warnings.push("Stripe not configured — checkout runs in stub mode.");

  checks.emailConfigured = Boolean(process.env.RESEND_API_KEY || process.env.SMTP_URL);
  if (!checks.emailConfigured) warnings.push("No mail provider — outbound email prints to the console.");

  checks.marketDataLive = (process.env.MARKET_DATA_PROVIDER ?? "mock") !== "mock";
  if (!checks.marketDataLive) warnings.push("Market data is the deterministic mock, not a live feed.");

  const authSecretSet =
    Boolean(process.env.AUTH_SECRET) && process.env.AUTH_SECRET !== "dev-secret-not-for-production";
  checks.authSecretSet = authSecretSet;
  if (!authSecretSet) warnings.push("AUTH_SECRET is unset or default — sessions are forgeable.");

  const legalGaps = unresolvedLegalPlaceholders();
  checks.legalIdentitySet = legalGaps.length === 0;
  if (legalGaps.length > 0) {
    warnings.push(`Legal identity unset: ${legalGaps.join(", ")}.`);
  }

  // Healthy means "serving requests". The warnings above are launch-readiness
  // gaps, not outages — failing health on them would take a working demo down.
  const healthy = checks.database;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      sandbox: isSandbox(),
      time: new Date().toISOString(),
      checks,
      socialLogin: enabledProviders().map((p) => p.id),
      warnings,
    },
    { status: healthy ? 200 : 503 },
  );
}
