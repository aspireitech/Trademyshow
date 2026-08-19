import { NextResponse } from "next/server";
import { refreshMarketData, runAlertJob, runDigestJob } from "@/lib/jobs";
import { purgeExpiredTokens } from "@/lib/tokens";
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
    case "purge":
      return NextResponse.json({ job, purged: purgeExpiredTokens() });
    case "market-data":
      // Must run before the digest job: a digest built on yesterday's cache
      // explains yesterday's moves.
      return NextResponse.json({ job, report: await refreshMarketData() });
    default:
      return NextResponse.json(
        { error: "job must be digest, alerts, purge or market-data" },
        { status: 400 },
      );
  }
}
