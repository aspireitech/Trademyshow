"use client";

/**
 * Dependency-free SVG price chart. No charting library — keeps the client
 * bundle tiny and renders instantly. Shows the line, a soft area fill, the
 * high/low bounds and an emphasized endpoint.
 */
export default function PriceChart({
  points,
  height = 180,
}: {
  points: { t: string; price: number }[];
  height?: number;
}) {
  if (points.length < 2) return <p className="dim">Not enough data.</p>;

  const W = 1000; // viewBox units; scales fluidly to the container
  const padY = 14;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = padY + (1 - (p.price - min) / span) * (height - padY * 2);
    return [x, y] as const;
  });

  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${height} L0,${height} Z`;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? "var(--gain)" : "var(--loss)";
  const [lastX, lastY] = xy[xy.length - 1];

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const label = (t: string) => (t.length > 10 ? t.slice(11, 16) : t.slice(5));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Price chart, ${up ? "up" : "down"} from ${fmt(prices[0])} to ${fmt(prices[prices.length - 1])}`}
      >
        <line x1="0" y1={padY} x2={W} y2={padY} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={height - padY} x2={W} y2={height - padY} stroke="var(--border)" strokeWidth="1" />
        <path d={area} fill={color} opacity="0.1" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r="4" fill={color} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }} className="dim mono">
        <span>{label(points[0].t)}</span>
        <span>
          low {fmt(min)} · high {fmt(max)}
        </span>
        <span>{label(points[points.length - 1].t)}</span>
      </div>
    </div>
  );
}
