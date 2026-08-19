import Link from "next/link";
import { buildTrackRecord, HORIZONS, type Horizon } from "@/lib/insight/trackrecord";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata = {
  title: "Track record — TradeMyShow",
  description:
    "Every Insight Score we have published, and what the stock actually did next. Hits and misses.",
};

/**
 * Public and unauthenticated on purpose. A track record behind a paywall is
 * a marketing claim; a track record anyone can check is evidence.
 */
export default async function TrackRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const { horizon: raw } = await searchParams;
  const requested = Number(raw ?? 30);
  const horizon: Horizon = (HORIZONS as readonly number[]).includes(requested)
    ? (requested as Horizon)
    : 30;
  const record = buildTrackRecord(horizon);

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/pricing">Pricing</Link>
          <Link href="/register" className="btn">
            Get started
          </Link>
        </div>
      </nav>

      <section className="section" style={{ borderTop: "none" }}>
        <h2>Our track record</h2>
        <p className="dim" style={{ maxWidth: "62ch", marginBottom: 20 }}>
          Every Insight Score we publish is recorded, then graded against what the stock actually
          did afterwards. Misses are shown alongside hits. If a score does not predict anything,
          this page is where you will see that first.
        </p>

        <div className="tf-tabs" style={{ marginBottom: 18 }}>
          {HORIZONS.map((h) => (
            <Link
              key={h}
              href={`/track-record?horizon=${h}`}
              className={h === horizon ? "active" : ""}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                color: h === horizon ? "var(--accent)" : "var(--text-dim)",
                borderColor: h === horizon ? "var(--accent)" : "var(--border)",
                background: h === horizon ? "var(--accent-soft)" : "transparent",
              }}
            >
              {h} days
            </Link>
          ))}
        </div>

        <div className="grid cols-3" style={{ marginBottom: 20 }}>
          <div className="card">
            <p className="dim" style={{ fontSize: 13 }}>
              Scores graded
            </p>
            <p className="mono" style={{ fontSize: 26, fontWeight: 700 }}>
              {record.totalSamples.toLocaleString()}
            </p>
            <p className="dim" style={{ fontSize: 12 }}>
              {record.pending} still open (horizon not yet elapsed)
            </p>
          </div>
          <div className="card">
            <p className="dim" style={{ fontSize: 13 }}>
              Overall hit rate
            </p>
            <p className="mono" style={{ fontSize: 26, fontWeight: 700 }}>
              {record.overallHitRate.toFixed(1)}%
            </p>
            <p className="dim" style={{ fontSize: 12 }}>
              Directional calls only — &quot;mixed&quot; scores make no claim and are excluded.
            </p>
          </div>
          <div className="card">
            <p className="dim" style={{ fontSize: 13 }}>
              Higher score = better outcome?
            </p>
            <p
              className="mono"
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: record.monotonic ? "var(--gain)" : "var(--warn)",
              }}
            >
              {record.monotonic ? "Yes" : "Not consistently"}
            </p>
            <p className="dim" style={{ fontSize: 12 }}>
              Whether average return falls as the band weakens.
            </p>
          </div>
        </div>

        <div className="card">
          <h3>By score band · {horizon}-day horizon</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Band</th>
                  <th>Scores</th>
                  <th>Hit rate</th>
                  <th>Avg return after {horizon}d</th>
                </tr>
              </thead>
              <tbody>
                {record.buckets.map((b) => (
                  <tr key={b.band}>
                    <td style={{ textTransform: "capitalize" }}>{b.band}</td>
                    <td className="mono dim">{b.samples}</td>
                    <td className="mono">
                      {b.graded ? (
                        `${b.hitRate.toFixed(1)}%`
                      ) : (
                        <span className="dim" title="This band makes no directional claim, so it is never graded.">
                          not graded
                        </span>
                      )}
                    </td>
                    <td className={`mono ${b.avgReturnPct >= 0 ? "gain" : "loss"}`}>
                      {b.avgReturnPct >= 0 ? "+" : ""}
                      {b.avgReturnPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
            A &quot;hit&quot; means a strong score (60+) was followed by a rise, or a weak score
            (under 40) by a fall. Generated {record.generatedAt}. Past performance does not predict
            future results, and this is not investment advice.
          </p>
        </div>
      </section>

      <footer className="site">
        <div className="container">
          TradeMyShow provides analytics and educational content only.
        </div>
      </footer>
    </div>
  );
}
