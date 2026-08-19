import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { REFERRAL_COMMISSION_PCT, referralSummary } from "@/lib/billing";
import { siteUrl } from "@/lib/site";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const summary = referralSummary(user.id, user.referralCode);
  return NextResponse.json({
    ...summary,
    commissionPct: REFERRAL_COMMISSION_PCT,
    shareUrl: user.referralCode ? `${siteUrl()}/register?ref=${user.referralCode}` : null,
  });
}
