import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listContracts, readContractPdf } from "@/lib/contracts";
import { audit } from "@/lib/security";

/** List this account's executed agreements. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ contracts: listContracts(user.id) });

  // Scoped to the caller's own id, so a guessed contract id gets nothing.
  const found = readContractPdf(user.id, id);
  if (!found) return NextResponse.json({ error: "not found" }, { status: 404 });

  audit(user.id, "contract.downloaded", id, req);
  return new NextResponse(new Uint8Array(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${id}.pdf"`,
      // Surfaced rather than hidden: a mismatch means the stored file changed
      // after it was written, which the account holder should know about.
      "X-Contract-Integrity": found.intact ? "verified" : "mismatch",
    },
  });
}
