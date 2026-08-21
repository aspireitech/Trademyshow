import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { clientIp } from "@/lib/security";
import { recordVisit, visitorStats } from "@/lib/visitors";

/** Record a page view and return how many this visitor has made today. */
export async function POST(req: Request) {
  const { path } = (await req.json().catch(() => ({}))) as { path?: string };

  const result = recordVisit(
    clientIp(req),
    req.headers.get("user-agent"),
    path ?? "/",
  );

  return NextResponse.json(result);
}

/** Aggregate engagement. Admin-only: it is everyone's traffic in one number. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(visitorStats());
}
