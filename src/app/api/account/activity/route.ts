import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { userActivity, type ActivityKind } from "@/lib/activity";

/** The account's own security and billing history. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const kind = params.get("kind") as ActivityKind | null;

  return NextResponse.json(
    userActivity(user.id, {
      limit: Number(params.get("limit") ?? 50),
      offset: Number(params.get("offset") ?? 0),
      kind: kind ?? undefined,
    }),
  );
}
