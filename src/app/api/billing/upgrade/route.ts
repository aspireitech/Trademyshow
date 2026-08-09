import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setUserPlan } from "@/lib/db";

/**
 * Billing stub. In production this becomes a Stripe Checkout session:
 *   POST -> stripe.checkout.sessions.create({ mode: "subscription", ... })
 * and the plan flip moves into the Stripe webhook handler
 * (checkout.session.completed -> setUserPlan(userId, "pro")).
 * For the MVP it flips the plan directly so the Pro experience is testable.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  setUserPlan(user.id, "pro");
  return NextResponse.json({ ok: true, plan: "pro" });
}
