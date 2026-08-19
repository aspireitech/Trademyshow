import { buildTrackRecord, HORIZONS, type Horizon } from "./trackrecord";
import type { ScoreBand } from "./score";

/**
 * What to expect next — answered with history, not prophecy.
 *
 * Users want a forward-looking number. The honest version of that is a base
 * rate: "when this stock's signals last looked like this, here is what
 * happened next, across N past cases." It is a measured frequency, not a
 * forecast, so it can be audited against the published track record — and it
 * carries its own sample size, so a thin, untrustworthy stat is visible as
 * such rather than dressed up as a prediction.
 */

export interface Expectation {
  band: ScoreBand;
  horizonDays: Horizon;
  /** Past cases in this band whose horizon has fully elapsed. */
  samples: number;
  /** Share of those cases that rose, 0-100. */
  rosePct: number;
  avgReturnPct: number;
  /** False when there is too little history to say anything useful. */
  reliable: boolean;
  summary: string;
}

/** Below this, a base rate is noise — we say so instead of quoting it. */
const MIN_SAMPLES = 20;

const cache = new Map<string, Expectation>();

export function expectationFor(
  band: ScoreBand,
  horizonDays: Horizon = 30,
  now: Date = new Date(),
): Expectation {
  const key = `${band}:${horizonDays}:${now.toISOString().slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const record = buildTrackRecord(horizonDays, now);
  const bucket = record.buckets.find((b) => b.band === band);

  const samples = bucket?.samples ?? 0;
  const avgReturnPct = bucket?.avgReturnPct ?? 0;
  // Directional bands report their measured hit rate; "mixed" makes no claim,
  // so we report how often it rose rather than pretending it was graded.
  const rosePct = bucket && bucket.graded > 0 ? bucket.hitRate : 0;
  const reliable = samples >= MIN_SAMPLES;

  const exp: Expectation = {
    band,
    horizonDays,
    samples,
    rosePct,
    avgReturnPct,
    reliable,
    summary: summarise(band, horizonDays, samples, avgReturnPct, reliable),
  };

  cache.set(key, exp);
  if (cache.size > 200) cache.clear();
  return exp;
}

function summarise(
  band: ScoreBand,
  horizonDays: number,
  samples: number,
  avgReturnPct: number,
  reliable: boolean,
): string {
  if (!reliable) {
    return `Only ${samples} comparable case${samples === 1 ? "" : "s"} on record — too few to draw a conclusion yet.`;
  }
  const dir = avgReturnPct >= 0 ? "gained" : "lost";
  return `Across ${samples} past cases with ${band} signals, the stock ${dir} ${Math.abs(avgReturnPct).toFixed(2)}% on average over the following ${horizonDays} days.`;
}

/** All horizons at once, for the expectation panel. */
export function expectationsFor(band: ScoreBand, now: Date = new Date()): Expectation[] {
  return HORIZONS.map((h) => expectationFor(band, h, now));
}

export function clearExpectationCache(): void {
  cache.clear();
}
