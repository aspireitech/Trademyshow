import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  isDowngrade, MAX_PAUSE_DAYS, nextPlanUp, pauseSubscription,
  resumeSubscription, subscriptionState,
} from "@/lib/billing";
import { setUserPlan } from "@/lib/db";
import { effectivePlan, isTrialing, PLAN_PRICING, TRIAL_DAYS, trialDaysRemaining } from "@/lib/plans";
import { audit } from "@/lib/security";
import type { Plan } from "@/lib/types";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The billing page must agree with the badge in the nav: a trialing account
  // has Pro's features on a free plan, and saying only "free" here reads as
  // the trial having silently ended.
  const trialing = isTrialing(user);
  const effective = effectivePlan(user);

  return NextResponse.json({
    state: subscriptionState(user),
    trialing,
    effectivePlan: effective,
    trialDaysRemaining: trialing ? trialDaysRemaining(user) : 0,
    // Nothing is being charged during a trial, so there is nothing to pause.
    canPause: user.plan !== "free",
    nextPlan: nextPlanUp(trialing ? "free" : user.plan),
    pricing: PLAN_PRICING,
    trialDays: TRIAL_DAYS,
    maxPauseDays: MAX_PAUSE_DAYS,
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, days, plan } = (await req.json().catch(() => ({}))) as {
    action?: "pause" | "resume" | "change";
    days?: number;
    plan?: Plan;
  };

  if (action === "pause") {
    const result = pauseSubscription(user.id, Number(days));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    audit(user.id, "billing.paused", `until ${result.resumesAt}`, req);
    return NextResponse.json({ ok: true, resumesAt: result.resumesAt });
  }

  if (action === "resume") {
    resumeSubscription(user.id);
    audit(user.id, "billing.resumed", undefined, req);
    return NextResponse.json({ ok: true });
  }

  if (action === "change") {
    if (!plan || !["free", "pro", "premium"].includes(plan)) {
      return NextResponse.json({ error: "plan must be free, pro or premium" }, { status: 400 });
    }
    // An upgrade takes payment and so goes through checkout; a downgrade is
    // applied here because nothing is being charged.
    if (!isDowngrade(user.plan, plan) && plan !== "free") {
      return NextResponse.json(
        { error: "Upgrades go through checkout.", checkout: "/api/billing/checkout" },
        { status: 409 },
      );
    }
    setUserPlan(user.id, plan);
    audit(user.id, "billing.plan_changed", `${user.plan} -> ${plan}`, req);
    return NextResponse.json({ ok: true, plan });
  }

  return NextResponse.json({ error: "action must be pause, resume or change" }, { status: 400 });
}
