import { describe, expect, it } from "vitest";
import { allocationSlices } from "@/lib/portfolio";

describe("allocationSlices", () => {
  it("returns nothing for an empty or all-zero portfolio", () => {
    expect(allocationSlices([])).toEqual([]);
    expect(allocationSlices([{ label: "AAPL", value: 0 }])).toEqual([]);
  });

  it("computes percentage of total for each holding", () => {
    const slices = allocationSlices([
      { label: "AAPL", value: 300 },
      { label: "AMD", value: 100 },
    ]);
    expect(slices).toHaveLength(2);
    expect(slices[0].label).toBe("AAPL");
    expect(slices[0].pct).toBeCloseTo(75, 5);
    expect(slices[1].pct).toBeCloseTo(25, 5);
  });

  it("sorts largest first regardless of input order", () => {
    const slices = allocationSlices([
      { label: "small", value: 10 },
      { label: "big", value: 90 },
    ]);
    expect(slices.map((s) => s.label)).toEqual(["big", "small"]);
  });

  it("folds anything past maxSlices into one Other bucket", () => {
    const slices = allocationSlices(
      [
        { label: "A", value: 40 },
        { label: "B", value: 30 },
        { label: "C", value: 10 },
        { label: "D", value: 10 },
      ],
      2,
    );
    expect(slices.map((s) => s.label)).toEqual(["A", "B", "Other"]);
    expect(slices[2].value).toBe(20);
    expect(slices[2].pct).toBeCloseTo(22.222, 2);
  });

  it("ignores negative or zero values rather than drawing a nonsense slice", () => {
    const slices = allocationSlices([
      { label: "AAPL", value: 100 },
      { label: "shorted", value: -50 },
    ]);
    expect(slices).toHaveLength(1);
    expect(slices[0].label).toBe("AAPL");
    expect(slices[0].pct).toBe(100);
  });

  it("assigns every slice a colour, reusing the palette past its length", () => {
    const inputs = Array.from({ length: 9 }, (_, i) => ({ label: `S${i}`, value: 10 }));
    const slices = allocationSlices(inputs, 9);
    const colours = new Set(slices.map((s) => s.color));
    expect(slices).toHaveLength(9);
    expect(colours.size).toBeGreaterThan(1);
  });
});
