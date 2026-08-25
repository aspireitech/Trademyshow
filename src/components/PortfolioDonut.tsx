import type { AllocationSlice } from "@/lib/portfolio";

const SIZE = 160;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Hand-rolled SVG donut — same reasoning as CompareChart's SVG line chart:
 * no charting dependency for one shape, and a stroke-dasharray ring is a
 * dozen lines of SVG, not a library.
 */
export default function PortfolioDonut({
  slices,
  centerLabel,
  centerValue,
}: {
  slices: AllocationSlice[];
  centerLabel?: string;
  centerValue?: string;
}) {
  if (slices.length === 0) {
    return (
      <div className="donut-empty" style={{ width: SIZE, height: SIZE }}>
        <span className="dim" style={{ fontSize: 12, textAlign: "center" }}>
          No positions yet
        </span>
      </div>
    );
  }

  let offset = 0;
  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Allocation breakdown">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        {slices.map((s) => {
          const len = (s.pct / 100) * CIRCUMFERENCE;
          const dasharray = `${len} ${CIRCUMFERENCE - len}`;
          const el = (
            <circle
              key={s.label}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={dasharray}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            >
              <title>{`${s.label}: ${s.pct.toFixed(1)}%`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="donut-center">
          {centerValue && <strong className="mono">{centerValue}</strong>}
          {centerLabel && <span className="dim">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
