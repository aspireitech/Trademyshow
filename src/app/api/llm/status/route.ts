import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getRouter, providerOrder } from "@/lib/llm";

/**
 * Live view of the failover chain: which provider is primary, which are
 * cooling down after a rate limit, and which are misconfigured. Useful for
 * ops dashboards and for confirming a quota event was handled rather than
 * silently degrading digests to the template writer.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const router = getRouter();
  const providers = router.status();
  const active = providers.find((p) => p.available) ?? null;

  return NextResponse.json({
    order: providerOrder(),
    activeProvider: active?.provider ?? null,
    fallbackToTemplate: providers.every((p) => !p.available),
    providers,
  });
}
