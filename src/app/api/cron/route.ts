import { NextResponse } from "next/server";
import { refreshMarketData, runAlertJob, runDigestJob, runTrialNudgeJob } from "@/lib/jobs";
import { createPromo } from "@/lib/billing";
import { purgeExpiredTokens } from "@/lib/tokens";
import { seedAllowed, seedSandbox } from "@/lib/seed";
import type { DigestPeriod } from "@/lib/types";

/**
 * Scheduled entry point, called by an external scheduler (Vercel Cron, GitHub
 * Actions, systemd timer). Protected by a shared secret rather than a session,
 * because there is no user behind it.
 */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });

  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const job = url.searchParams.get("job") ?? "digest";
  const period = (url.searchParams.get("period") ?? "daily") as DigestPeriod;

  switch (job) {
    case "digest":
      return NextResponse.json({ job, period, report: await runDigestJob(period) });
    case "alerts":
      return NextResponse.json({ job, fired: runAlertJob().length });
    case "trial-nudge":
      return NextResponse.json({ job, report: await runTrialNudgeJob() });
    case "purge":
      return NextResponse.json({ job, purged: purgeExpiredTokens() });
    case "seed": {
      // Sandbox-only, and still behind CRON_SECRET: this creates accounts whose
      // passwords are printed on the landing page.
      const permitted = seedAllowed();
      if (!permitted.allowed) {
        return NextResponse.json({ error: permitted.reason }, { status: 403 });
      }
      return NextResponse.json({ job, report: await seedSandbox() });
    }
    case "market-data":
      // Must run before the digest job: a digest built on yesterday's cache
      // explains yesterday's moves.
      return NextResponse.json({ job, report: await refreshMarketData() });
    case "promo": {
      // Same reasoning as "seed": reachable over HTTP because a deployed
      // container has no source tree to run a script from. Behind
      // CRON_SECRET, same as every other job here — this mints a working
      // discount code, so it is not something to leave open.
      const code = url.searchParams.get("code");
      const percent = Number(url.searchParams.get("percent") ?? "");
      if (!code || !Number.isFinite(percent) || percent <= 0 || percent > 100) {
        return NextResponse.json(
          { error: "promo needs code and percent (1-100) query params" },
          { status: 400 },
        );
      }
      const maxParam = url.searchParams.get("max");
      const maxRedemptions = maxParam ? Number(maxParam) : undefined;
      const expiresAt = url.searchParams.get("expires") ?? undefined;
      createPromo(code, percent, maxRedemptions, expiresAt);
      return NextResponse.json({ job, code: code.toUpperCase(), percent, maxRedemptions, expiresAt });
    }
    default:
      return NextResponse.json(
        { error: "job must be digest, alerts, trial-nudge, purge, market-data, promo or seed" },
        { status: 400 },
      );
  }
}
