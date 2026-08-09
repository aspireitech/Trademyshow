import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <Link href="/login">Log in</Link>
          <Link href="/register" className="btn">
            Get started
          </Link>
        </div>
      </nav>
      <section className="section" style={{ borderTop: "none" }}>
        <h2>Simple pricing</h2>
        <div className="grid cols-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <div className="card">
            <span className="badge">Free</span>
            <p className="price" style={{ marginTop: 10 }}>
              $0 <small>/ month</small>
            </p>
            <ul className="features">
              <li>1 group, up to 3 stocks</li>
              <li>Daily AI digest (summary)</li>
              <li>All timeframes: 1D → all-time</li>
              <li>Related news per stock</li>
            </ul>
            <Link href="/register" className="btn secondary">
              Start free
            </Link>
          </div>
          <div className="card" style={{ borderColor: "var(--accent)" }}>
            <span className="badge pro">Pro</span>
            <p className="price" style={{ marginTop: 10 }}>
              $9 <small>/ month</small>
            </p>
            <ul className="features">
              <li>10 groups, up to 30 stocks each</li>
              <li>Deep digest: per-holding analysis</li>
              <li>Contribution attribution for every stock</li>
              <li>Full news mapping &amp; history</li>
            </ul>
            <Link href="/register" className="btn">
              Go Pro
            </Link>
          </div>
        </div>
        <p className="dim" style={{ marginTop: 24, fontSize: 13 }}>
          Analytics and education only — never investment advice.
        </p>
      </section>
    </div>
  );
}
