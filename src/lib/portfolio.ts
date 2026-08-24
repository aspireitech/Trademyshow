/**
 * Pure allocation math for the portfolio donut charts.
 *
 * Kept separate from the digest engine's per-group facts because this runs
 * across *multiple* groups at once (the "all portfolios" rollup), where the
 * digest engine only ever sees one. Both read the same holdings/quotes; this
 * file just reshapes totals into slices a donut can draw.
 */

export interface AllocationInput {
  label: string;
  value: number;
}

export interface AllocationSlice extends AllocationInput {
  pct: number;
  color: string;
}

/** Distinguishable in both themes and to the most common colour deficiencies. */
export const SLICE_COLOURS = [
  "#2563eb",
  "#e8710a",
  "#0f766e",
  "#a21caf",
  "#b91c1c",
  "#65a30d",
  "#9333ea",
  "#0891b2",
] as const;

const OTHER_COLOUR = "#9ca3af";

/**
 * Turns raw values into slices, largest first, folding anything past the
 * first `maxSlices` into a single "Other" wedge. A dozen sub-1% positions as
 * a dozen slivers is not a chart anyone can read; one honest "Other" bucket
 * is.
 */
export function allocationSlices(inputs: AllocationInput[], maxSlices = 6): AllocationSlice[] {
  const positive = inputs.filter((i) => i.value > 0);
  const total = positive.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0) return [];

  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices);
  const rest = sorted.slice(maxSlices);

  const slices: AllocationSlice[] = head.map((i, idx) => ({
    label: i.label,
    value: i.value,
    pct: (i.value / total) * 100,
    color: SLICE_COLOURS[idx % SLICE_COLOURS.length],
  }));

  if (rest.length > 0) {
    const otherValue = rest.reduce((sum, i) => sum + i.value, 0);
    slices.push({ label: "Other", value: otherValue, pct: (otherValue / total) * 100, color: OTHER_COLOUR });
  }

  return slices;
}
