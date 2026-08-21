import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { audit, limitRequest, tooManyRequests } from "@/lib/security";
import { issuePhoneCode, maskPhone, removePhone, verifyPhoneCode } from "@/lib/sms";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    phone: user.phone ? maskPhone(user.phone) : null,
    verified: Boolean(user.phoneVerifiedAt),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Each send costs money and reaches a real handset, so the limit is tight.
  const limit = limitRequest(req, "emailVerify", String(user.id));
  if (!limit.allowed) return tooManyRequests(limit);

  const { action, phone, code } = (await req.json().catch(() => ({}))) as {
    action?: "send" | "verify";
    phone?: string;
    code?: string;
  };

  if (action === "send") {
    if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
    const result = await issuePhoneCode(user.id, phone);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, devCode: result.devCode });
  }

  if (action === "verify") {
    if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });
    const result = verifyPhoneCode(user.id, code);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    audit(user.id, "phone.verified", undefined, req);
    return NextResponse.json({ ok: true, phone: maskPhone(result.phone!) });
  }

  return NextResponse.json({ error: "action must be send or verify" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  removePhone(user.id);
  audit(user.id, "phone.removed", undefined, req);
  return NextResponse.json({ ok: true });
}
