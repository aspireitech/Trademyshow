import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { effectiveLimits, effectivePlan, isTrialing, trialDaysRemaining } from "@/lib/plans";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user,
    effectivePlan: effectivePlan(user),
    trialing: isTrialing(user),
    trialDaysRemaining: trialDaysRemaining(user),
    limits: effectiveLimits(user),
  });
}
