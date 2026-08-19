import { currentUser } from "@/lib/auth";
import { exportUserData } from "@/lib/db";
import { audit } from "@/lib/security";

/** GDPR/CCPA data portability — everything we hold, as a JSON download. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  audit(user.id, "account.exported", undefined, req);
  const data = exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="trademyshow-export-${user.id}.json"`,
    },
  });
}
