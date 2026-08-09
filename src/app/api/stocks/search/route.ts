import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { searchStocks } from "@/lib/marketdata";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: searchStocks(q) });
}
