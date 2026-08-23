import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { coverage, historyMissing, refreshMarket, type RefreshSummary } from "@/lib/marketrefresh";
import { providerChoice, sourceText, sourceFor } from "@/lib/providers/feed";
import { quoteAgeHours } from "@/lib/providers/cache";
import { getQuote, symbolStats } from "@/lib/marketdata";

/**
 * Fill the market cache on demand.
 *
 * The scheduled job is the normal path, but a fresh installation has an empty
 * cache and nobody wants to read a README before seeing real prices — so the
 * landing page can ask for a fill itself. That makes this endpoint reachable
 * without a session, which is safe only because of the two guards below:
 *
 *   - one refresh at a time, process-wide, so parallel requests coalesce
 *     rather than multiplying into a burst the vendor will rate-limit;
 *   - a floor between runs, so a page left open, or a bored visitor with a
 *     reload key, cannot turn into a flood.
 *
 * There is nothing user-specific to leak here: it writes public closing prices
 * into a shared cache.
 */

const MIN_INTERVAL_MS = 60_000;

let inFlight: Promise<RefreshSummary> | null = null;
let lastRunAt = 0;
let lastSummary: RefreshSummary | null = null;

/**
 * A handful of liquid names anyone can check against a public quote page in
 * ten seconds. Chosen to span the failure modes: a mega cap, a slow-moving
 * pharma, an index tracker, and a coin that trades at the weekend.
 */
const SAMPLE = ["AAPL", "AMZN", "JNJ", "SPY", "BTC-USD"];

export async function GET() {
  const cov = coverage();

  // Per-symbol provenance, so "is this real?" is answerable by looking rather
  // than by trusting a percentage.
  const sample = SAMPLE.map((symbol) => {
    const label = sourceFor(symbol);
    const stats = symbolStats(symbol);
    return {
      symbol,
      price: getQuote(symbol).price,
      source: label.source,
      text: sourceText(label),
      ageHours: quoteAgeHours(symbol),
      quoteTime: stats?.quoteTime ?? null,
      exchange: stats?.exchange ?? null,
    };
  });

  return NextResponse.json({
    provider: providerChoice(),
    coverage: cov,
    historyMissing: historyMissing(),
    lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
    lastSummary,
    sample,
  });
}

export async function POST() {
  const user = await currentUser();
  const since = Date.now() - lastRunAt;

  // An admin asking for a refresh is asking deliberately and waits through the
  // interval; everyone else is a page doing housekeeping and gets told to come
  // back later rather than made to wait.
  if (!inFlight && since < MIN_INTERVAL_MS && user?.role !== "admin") {
    return NextResponse.json(
      { skipped: "refreshed recently", retryAfterMs: MIN_INTERVAL_MS - since, coverage: coverage() },
      { status: 429 },
    );
  }

  if (!inFlight) {
    const withHistory = historyMissing();
    lastRunAt = Date.now();
    inFlight = refreshMarket({ withHistory }).finally(() => {
      inFlight = null;
      lastRunAt = Date.now();
    });
  }

  const summary = await inFlight;
  lastSummary = summary;
  return NextResponse.json({ summary, coverage: coverage() });
}
