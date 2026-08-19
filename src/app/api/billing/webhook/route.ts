import { NextResponse } from "next/server";
import { applyPaidPlan, convertReferral, verifyStripeSignature } from "@/lib/billing";
import { setUserPlan } from "@/lib/db";
import { audit } from "@/lib/security";

/**
 * Stripe webhook.
 *
 * The raw body is required — re-serialising JSON changes the bytes and breaks
 * the signature. Unsigned or stale requests are rejected before anything is
 * read, since this endpoint can grant paid access.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhooks are not configured" }, { status: 503 });
  }

  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    audit(null, "billing.webhook_rejected", "bad signature", req);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, unknown> };
  };
  const object = event.data.object;
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const userId = Number(metadata.user_id);
  const plan = metadata.plan as "pro" | "premium" | undefined;

  switch (event.type) {
    case "checkout.session.completed":
    case "invoice.payment_succeeded": {
      if (userId && plan) {
        applyPaidPlan(userId, plan);
        const paid = Number(object.amount_total ?? object.amount_paid ?? 0);
        // A referral only earns once the referred account actually pays.
        convertReferral(userId, paid);
        audit(userId, "billing.payment_succeeded", `${plan} · ${paid}c`, req);
      }
      break;
    }
    case "customer.subscription.deleted":
    case "invoice.payment_failed": {
      // Downgrade rather than delete: the account keeps its data on Free.
      if (userId) {
        setUserPlan(userId, "free");
        audit(userId, `billing.${event.type}`, undefined, req);
      }
      break;
    }
    default:
      // Unhandled types are acknowledged so Stripe stops retrying them.
      break;
  }

  return NextResponse.json({ received: true });
}
