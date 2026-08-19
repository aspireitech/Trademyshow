import { NextResponse } from "next/server";
import { authorizeUrl, type OAuthProvider } from "@/lib/oauth";

/** Kick off the provider redirect. Unconfigured providers 404 rather than
 *  advertising that the route exists. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const query = new URL(req.url).searchParams;
  const ref = query.get("ref") ?? undefined;
  const terms = query.get("terms") ?? undefined;
  const url = authorizeUrl(provider as OAuthProvider, ref, terms);
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(url);
}
