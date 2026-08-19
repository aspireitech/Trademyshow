import { NextResponse } from "next/server";
import { assertCsrf, csrfFailed, currentUser } from "@/lib/auth";
import { applyPaidPlan, checkPromo, createCheckoutSession, redeemPromo, stripeConfigured } from "@/lib/billing";
import { audit } from "@/lib/security";
import { siteUrl } from "@/lib/site";
import type { Plan } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await assertCsrf(req))) return csrfFailed();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { plan, interval, promoCode } = (await req.json().catch(() => ({}))) as {
    plan?: string;
    interval?: string;
    promoCode?: string;
  };

  const target = (plan ?? "pro") as Plan;
  if (target !== "pro" && target !== "premium") {
    return NextResponse.json({ error: "plan must be 'pro' or 'premium'" }, { status: 400 });
  }
  const billingInterval = interval === "annual" ? "annual" : "monthly";

  if (promoCode) {
    const promo = checkPromo(promoCode);
    if (!promo.valid) return NextResponse.json({ error: promo.reason }, { status: 400 });
  }

  const session = await createCheckoutSession(
    user.id,
    user.email,
    target,
    billingInterval,
    `${siteUrl()}/dashboard?upgraded=1`,
    `${siteUrl()}/pricing?cancelled=1`,
    promoCode,
  );

  // Stub mode has no Stripe to call back, so the plan is applied here instead.
  if (session.stub) {
    applyPaidPlan(user.id, target);
    if (promoCode) redeemPromo(promoCode);
    audit(user.id, "billing.upgraded_stub", `${target}/${billingInterval}`, req);
  } else {
    audit(user.id, "billing.checkout_started", `${target}/${billingInterval}`, req);
  }

  return NextResponse.json({
    url: session.url,
    stub: session.stub,
    stripeConfigured: stripeConfigured(),
  });
}
