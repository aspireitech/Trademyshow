import { NextResponse } from "next/server";
import { buildTrackRecord, HORIZONS, type Horizon } from "@/lib/insight/trackrecord";

/**
 * Public on purpose. The track record is the trust mechanism — putting it
 * behind a login would defeat the point of publishing it.
 */
export async function GET(req: Request) {
  const raw = Number(new URL(req.url).searchParams.get("horizon") ?? 30);
  const horizon = (HORIZONS as readonly number[]).includes(raw) ? (raw as Horizon) : 30;
  return NextResponse.json({ record: buildTrackRecord(horizon) });
}
