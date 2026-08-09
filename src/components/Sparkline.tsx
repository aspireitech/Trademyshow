"use client";

/**
 * Minimal dependency-free SVG line chart. Color encodes direction over the
 * window (green up, red down); the filled area keeps it readable at small
 * sizes. Values are expected in chronological order.
 */
export default function Sparkline({
  values,
  width = 120,
  height = 36,
  strokeWidth = 1.5,
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  ariaLabel?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const color = up ? "var(--gain)" : "var(--loss)";
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${height - pad} L${pts[0][0].toFixed(1)},${height - pad} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `price trend, ${up ? "up" : "down"} over period`}
    >
      <path d={area} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}
