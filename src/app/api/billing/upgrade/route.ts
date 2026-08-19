import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setUserPlan } from "@/lib/db";
import { PLAN_PRICING } from "@/lib/plans";
import type { Plan } from "@/lib/types";

/**
 * Billing stub. In production this becomes a Stripe Checkout session:
 *   stripe.checkout.sessions.create({ mode: "subscription", ... })
 * and the plan change moves into the webhook handler
 * (checkout.session.completed -> setUserPlan). For now it flips the plan
 * directly so the paid experience is testable end to end.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
  const target = (plan ?? "pro") as Plan;
  if (target !== "pro" && target !== "premium") {
    return NextResponse.json({ error: "plan must be 'pro' or 'premium'" }, { status: 400 });
  }

  setUserPlan(user.id, target);
  return NextResponse.json({ ok: true, plan: target, pricing: PLAN_PRICING[target] });
}
