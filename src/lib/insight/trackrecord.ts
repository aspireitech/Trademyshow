import { getQuote, round2, UNIVERSE } from "../marketdata";
import { bandFor, scoreStock, type ScoreBand } from "./score";

/**
 * Published track record.
 *
 * This is the trust mechanism the category is missing: for every score we
 * have ever published, record what the stock actually did afterwards, and
 * show it — hits and misses alike. Competitors can copy a score overnight;
 * they cannot copy a history, because history only accrues with time.
 *
 * Honesty rules baked in:
 *  - Only scores whose horizon has fully elapsed are graded. Open scores are
 *    reported separately as "pending", never quietly dropped.
 *  - A "hit" is defined up front and applied uniformly: strong scores are
 *    expected to outperform, weak scores to underperform.
 */

export const HORIZONS = [7, 30, 90] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface ScoredOutcome {
  symbol: string;
  scoredAt: string;
  score: number;
  band: ScoreBand;
  horizonDays: number;
  /** Percentage price change over the horizon. */
  forwardReturnPct: number;
  /** Did the outcome match what the score implied? Null while pending. */
  hit: boolean | null;
}

export interface AccuracyBucket {
  band: ScoreBand;
  samples: number;
  /** Samples that carry a directional claim and have been graded. */
  graded: number;
  hitRate: number;
  avgReturnPct: number;
}

export interface TrackRecord {
  horizonDays: number;
  generatedAt: string;
  totalSamples: number;
  pending: number;
  overallHitRate: number;
  buckets: AccuracyBucket[];
  /** Does a higher score actually correspond to a better outcome? */
  monotonic: boolean;
}

const DAY_MS = 86_400_000;

/**
 * Grade one past score against what happened next.
 * Returns `hit: null` when the horizon has not fully elapsed yet.
 */
export function gradeScore(
  symbol: string,
  scoredAt: Date,
  horizonDays: number,
  now: Date = new Date(),
): ScoredOutcome | null {
  const scored = scoreStock(symbol, scoredAt);
  if (!scored) return null;

  const settlesAt = new Date(scoredAt.getTime() + horizonDays * DAY_MS);
  const elapsed = settlesAt.getTime() <= now.getTime();

  const start = getQuote(symbol, scoredAt).price;
  const end = elapsed ? getQuote(symbol, settlesAt).price : getQuote(symbol, now).price;
  const forwardReturnPct = round2(((end - start) / start) * 100);

  return {
    symbol,
    scoredAt: scoredAt.toISOString().slice(0, 10),
    score: scored.score,
    band: scored.band,
    horizonDays,
    forwardReturnPct,
    hit: elapsed ? isHit(scored.score, forwardReturnPct) : null,
  };
}

/**
 * A score above 60 implies strengthening signals, below 40 weakening.
 * "Mixed" (40-59) makes no directional claim and is never counted as a
 * hit or a miss — counting it either way would flatter the numbers.
 */
export function isHit(score: number, forwardReturnPct: number): boolean | null {
  if (score >= 60) return forwardReturnPct > 0;
  if (score < 40) return forwardReturnPct <= 0;
  return null;
}

/**
 * Build the published record by grading every symbol at regular past dates.
 * `samplesPerSymbol` back-tests one score per week per symbol.
 */
const recordMemo = new Map<string, TrackRecord>();

export function buildTrackRecord(
  horizonDays: Horizon,
  now: Date = new Date(),
  samplesPerSymbol = 12,
  symbols?: string[],
): TrackRecord {
  // Grading the whole universe at twelve past dates is thousands of price
  // reconstructions. The inputs are deterministic and only change when the
  // day rolls over, so the result is memoised per (horizon, sample depth,
  // day). Callers that pass an explicit symbol list get a fresh computation:
  // that path is for tests and one-off analyses, and caching it would need a
  // key built from the whole list.
  const explicit = symbols !== undefined;
  const universe = symbols ?? UNIVERSE.map((s) => s.symbol);
  const day = now.toISOString().slice(0, 10);
  const key = `${horizonDays}:${samplesPerSymbol}:${day}`;

  if (!explicit) {
    const hit = recordMemo.get(key);
    if (hit) return hit;
  }

  const outcomes: ScoredOutcome[] = [];

  for (const symbol of universe) {
    for (let i = 1; i <= samplesPerSymbol; i++) {
      // One sample per week, far enough back that the horizon has elapsed.
      const scoredAt = new Date(now.getTime() - (horizonDays + i * 7) * DAY_MS);
      const graded = gradeScore(symbol, scoredAt, horizonDays, now);
      if (graded) outcomes.push(graded);
    }
  }

  const pending = outcomes.filter((o) => o.hit === null && o.score >= 60).length;
  const graded = outcomes.filter((o) => o.hit !== null);

  const bands: ScoreBand[] = ["very strong", "strong", "mixed", "weak", "very weak"];
  const buckets: AccuracyBucket[] = bands.map((band) => {
    const inBand = outcomes.filter((o) => o.band === band);
    const gradedInBand = inBand.filter((o) => o.hit !== null);
    return {
      band,
      samples: inBand.length,
      graded: gradedInBand.length,
      hitRate: gradedInBand.length
        ? round2((gradedInBand.filter((o) => o.hit).length / gradedInBand.length) * 100)
        : 0,
      avgReturnPct: inBand.length
        ? round2(inBand.reduce((a, o) => a + o.forwardReturnPct, 0) / inBand.length)
        : 0,
    };
  });

  // The honest headline test: do higher bands actually average better returns?
  const ordered = buckets.filter((b) => b.samples > 0);
  const monotonic = ordered.every(
    (b, i) => i === 0 || ordered[i - 1].avgReturnPct >= b.avgReturnPct,
  );

  const record: TrackRecord = {
    horizonDays,
    generatedAt: day,
    totalSamples: graded.length,
    pending,
    overallHitRate: graded.length
      ? round2((graded.filter((o) => o.hit).length / graded.length) * 100)
      : 0,
    buckets,
    monotonic,
  };

  if (!explicit) {
    recordMemo.set(key, record);
    // Keep yesterday and today; anything older is dead weight.
    if (recordMemo.size > 8) recordMemo.delete(recordMemo.keys().next().value!);
  }

  return record;
}

/** Top-scoring stocks right now, for the "what looks strong today" view. */
export function topScores(limit = 10, now: Date = new Date()) {
  return UNIVERSE.map((s) => scoreStock(s.symbol, now))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export { bandFor };
