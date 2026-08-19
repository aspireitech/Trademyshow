import { describe, expect, it } from "vitest";
import { bandFor, scoreStock } from "@/lib/insight/score";
import { buildTrackRecord, gradeScore, isHit, topScores } from "@/lib/insight/trackrecord";

const asOf = new Date("2026-08-07T16:00:00Z");

describe("insight score", () => {
  it("returns a 0-100 composite for a known symbol", () => {
    const s = scoreStock("AAPL", asOf)!;
    expect(s.symbol).toBe("AAPL");
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });

  it("returns null for an unknown symbol", () => {
    expect(scoreStock("NOPE", asOf)).toBeNull();
  });

  it("is deterministic for the same symbol and date", () => {
    expect(scoreStock("NVDA", asOf)).toEqual(scoreStock("NVDA", asOf));
  });

  it("composite equals the sum of weighted component contributions", () => {
    const s = scoreStock("MSFT", asOf)!;
    const sum = s.components.reduce((a, c) => a + c.contribution, 0);
    expect(s.score).toBeCloseTo(sum, 1);
  });

  it("component weights sum to 1 — the score is fully accounted for", () => {
    const s = scoreStock("TSLA", asOf)!;
    expect(s.components.reduce((a, c) => a + c.weight, 0)).toBeCloseTo(1, 5);
  });

  it("exposes all four components, each with an auditable explanation", () => {
    const s = scoreStock("AMD", asOf)!;
    expect(s.components.map((c) => c.key).sort()).toEqual([
      "momentum",
      "news",
      "stability",
      "trend",
    ]);
    for (const c of s.components) {
      expect(c.value).toBeGreaterThanOrEqual(0);
      expect(c.value).toBeLessThanOrEqual(100);
      expect(c.detail.length).toBeGreaterThan(10);
    }
  });

  it("bands map to the documented thresholds", () => {
    expect(bandFor(95)).toBe("very strong");
    expect(bandFor(80)).toBe("very strong");
    expect(bandFor(60)).toBe("strong");
    expect(bandFor(59.9)).toBe("mixed");
    expect(bandFor(40)).toBe("mixed");
    expect(bandFor(39.9)).toBe("weak");
    expect(bandFor(20)).toBe("weak");
    expect(bandFor(19.9)).toBe("very weak");
    expect(bandFor(0)).toBe("very weak");
  });

  it("scores every symbol in the universe without throwing", () => {
    for (const s of topScores(100, asOf)) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("topScores returns highest first", () => {
    const top = topScores(5, asOf);
    const sorted = [...top].sort((a, b) => b.score - a.score);
    expect(top.map((s) => s.symbol)).toEqual(sorted.map((s) => s.symbol));
  });
});

describe("hit definition is honest", () => {
  it("counts a strong score as a hit only when the stock rose", () => {
    expect(isHit(75, 3)).toBe(true);
    expect(isHit(75, -3)).toBe(false);
  });

  it("counts a weak score as a hit only when the stock fell or was flat", () => {
    expect(isHit(25, -3)).toBe(true);
    expect(isHit(25, 3)).toBe(false);
  });

  it("never grades a mixed score — it makes no directional claim", () => {
    expect(isHit(50, 10)).toBeNull();
    expect(isHit(50, -10)).toBeNull();
    expect(isHit(45, 0)).toBeNull();
  });
});

describe("track record", () => {
  it("grades a past score against the realised forward return", () => {
    const scoredAt = new Date(asOf.getTime() - 60 * 86_400_000);
    const g = gradeScore("AAPL", scoredAt, 30, asOf)!;
    expect(g.symbol).toBe("AAPL");
    expect(g.horizonDays).toBe(30);
    expect(typeof g.forwardReturnPct).toBe("number");
    expect(g.hit === true || g.hit === false || g.hit === null).toBe(true);
  });

  it("leaves a score pending when its horizon has not elapsed", () => {
    const scoredAt = new Date(asOf.getTime() - 5 * 86_400_000);
    const g = gradeScore("AAPL", scoredAt, 30, asOf)!;
    expect(g.hit).toBeNull();
  });

  it("builds a record across every horizon", () => {
    for (const h of [7, 30, 90] as const) {
      const rec = buildTrackRecord(h, asOf, 4, ["AAPL", "MSFT", "NVDA", "JPM", "XOM"]);
      expect(rec.horizonDays).toBe(h);
      expect(rec.totalSamples).toBeGreaterThan(0);
      expect(rec.overallHitRate).toBeGreaterThanOrEqual(0);
      expect(rec.overallHitRate).toBeLessThanOrEqual(100);
      expect(rec.buckets).toHaveLength(5);
    }
  });

  it("reports pending scores rather than hiding them", () => {
    const rec = buildTrackRecord(30, asOf, 4, ["AAPL", "NVDA"]);
    expect(rec.pending).toBeGreaterThanOrEqual(0);
    expect(typeof rec.monotonic).toBe("boolean");
  });

  it("bucket hit rates stay within 0-100 and sample counts are non-negative", () => {
    const rec = buildTrackRecord(30, asOf, 6, ["AAPL", "MSFT", "TSLA", "AMD"]);
    for (const b of rec.buckets) {
      expect(b.samples).toBeGreaterThanOrEqual(0);
      expect(b.hitRate).toBeGreaterThanOrEqual(0);
      expect(b.hitRate).toBeLessThanOrEqual(100);
    }
    const bucketSamples = rec.buckets.reduce((a, b) => a + b.samples, 0);
    expect(bucketSamples).toBeGreaterThanOrEqual(rec.totalSamples);
  });

  it("distinguishes an ungraded band from a 0% hit rate", () => {
    const rec = buildTrackRecord(30, asOf, 6, ["AAPL", "MSFT", "TSLA", "AMD"]);
    const mixed = rec.buckets.find((b) => b.band === "mixed")!;
    // "Mixed" makes no directional claim, so it is never graded — the UI must
    // be able to tell that apart from "graded, and always wrong".
    expect(mixed.graded).toBe(0);
    for (const b of rec.buckets) {
      expect(b.graded).toBeLessThanOrEqual(b.samples);
      if (b.graded === 0) expect(b.hitRate).toBe(0);
    }
  });

  it("is deterministic — the published record cannot drift between loads", () => {
    const a = buildTrackRecord(30, asOf, 4, ["AAPL", "MSFT"]);
    const b = buildTrackRecord(30, asOf, 4, ["AAPL", "MSFT"]);
    expect(a).toEqual(b);
  });
});
