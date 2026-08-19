import { NextResponse } from "next/server";
import { checkPromo } from "@/lib/billing";

/** Validate a promo code before checkout so the discount can be previewed. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
  return NextResponse.json(checkPromo(code));
}
