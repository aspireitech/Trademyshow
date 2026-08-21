"use client";

import Link from "next/link";
import type { InsightScore } from "@/lib/insight/score";
import type { Expectation } from "@/lib/insight/expectation";

/**
 * The Insight Score, shown with its full component breakdown.
 *
 * Every part of the number is visible on purpose: a score a user cannot
 * audit is a score they have no reason to trust.
 */
/** Semantic colour for a 0-100 component, matching the band thresholds. */
function toneFor(value: number): string {
  if (value >= 60) return "var(--gain)";
  if (value >= 40) return "var(--warn)";
  return "var(--loss)";
}

export default function ScoreCard({
  score,
  expectations,
}: {
  score: InsightScore & { masked?: boolean };
  expectations: Expectation[] | null;
}) {
  const hue =
    score.score >= 60 ? "var(--gain)" : score.score >= 40 ? "var(--warn)" : "var(--loss)";
  // Text on a tint of its own hue never reaches AA — the tint drags the ground
  // toward the text. The dial can use the vivid hue because it is a graphic;
  // the chip's label cannot.
  const chipInk =
    score.score >= 60 ? "var(--badge-gain)" : score.score >= 40 ? "var(--badge-warn)" : "var(--badge-loss)";

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div
          className="score-dial"
          style={{ background: `conic-gradient(${hue} ${score.score * 3.6}deg, var(--bg) 0)` }}
        >
          <span className="mono">{Math.round(score.score)}</span>
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Insight Score</h3>
          <p style={{ marginBottom: 2 }}>
            <span
              className="band-chip"
              style={{ color: chipInk, borderColor: chipInk, background: `color-mix(in srgb, ${hue} 12%, transparent)` }}
            >
              {score.band} signals
            </span>
          </p>
          <p className="dim" style={{ fontSize: 12 }}>
            A measure of current signal strength — not a buy or sell recommendation.
          </p>
        </div>
      </div>

      {score.masked && (
        <p className="dim" style={{ fontSize: 13, marginTop: 14 }}>
          The exact score and its four-part breakdown are part of Pro.{" "}
          <Link href="/pricing">See plans →</Link>
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {score.components.map((c) => (
          <div key={c.key}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>
                {c.label} <span className="dim">· {(c.weight * 100).toFixed(0)}% weight</span>
              </span>
              <span className="mono" style={{ color: toneFor(c.value), fontWeight: 700 }}>
                {c.value.toFixed(0)}
                <span className="dim" style={{ fontWeight: 400 }}>/100</span>
              </span>
            </div>
            <div className="bar" aria-hidden="true">
              <div
                className="bar-fill"
                style={{ width: `${c.value}%`, background: toneFor(c.value) }}
              />
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              {c.detail}
            </p>
          </div>
        ))}
      </div>

      {expectations && expectations.length > 0 && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h3 style={{ marginBottom: 4 }}>What usually happened next</h3>
          <p className="dim" style={{ fontSize: 12, marginBottom: 10 }}>
            Measured base rates from past cases with {score.band} signals — history, not a
            forecast.
          </p>
          <div className="tf-grid">
            {expectations.map((e) => (
              <div key={e.horizonDays} className="tf-cell" style={{ cursor: "default" }}>
                <span className="dim">{e.horizonDays}d</span>
                {e.reliable ? (
                  <strong className={`mono ${e.avgReturnPct >= 0 ? "gain" : "loss"}`}>
                    {e.avgReturnPct >= 0 ? "+" : ""}
                    {e.avgReturnPct.toFixed(2)}%
                  </strong>
                ) : (
                  <strong className="dim mono">n/a</strong>
                )}
                <span className="dim" style={{ fontSize: 10 }}>
                  {e.samples} case{e.samples === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
            {expectations.find((e) => e.horizonDays === 30)?.summary}
          </p>
        </div>
      )}
    </div>
  );
}
