"use client";

import type { InsightScore } from "@/lib/insight/score";

/**
 * The Insight Score, shown with its full component breakdown.
 *
 * Every part of the number is visible on purpose: a score a user cannot
 * audit is a score they have no reason to trust.
 */
export default function ScoreCard({ score }: { score: InsightScore }) {
  const hue =
    score.score >= 60 ? "var(--gain)" : score.score >= 40 ? "var(--warn)" : "var(--loss)";

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
          <p style={{ color: hue, fontWeight: 700, textTransform: "capitalize" }}>{score.band} signals</p>
          <p className="dim" style={{ fontSize: 12 }}>
            A measure of current signal strength — not a buy or sell recommendation.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {score.components.map((c) => (
          <div key={c.key}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>
                {c.label} <span className="dim">· {(c.weight * 100).toFixed(0)}% weight</span>
              </span>
              <span className="mono">{c.value.toFixed(0)}/100</span>
            </div>
            <div className="bar" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${c.value}%` }} />
            </div>
            <p className="dim" style={{ fontSize: 12, marginTop: 2 }}>
              {c.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
