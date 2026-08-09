import Link from "next/link";
import { currentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await currentUser();
  return (
    <>
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">
            Trade<span>MyShow</span>
          </Link>
          <div className="links">
            <Link href="/pricing">Pricing</Link>
            {user ? (
              <Link href="/dashboard" className="btn">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/register" className="btn">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>

        <section className="hero">
          <h1>
            Know exactly <em>why</em> your portfolio moved today
          </h1>
          <p className="sub">
            Group your favorite stocks, and every day our AI explains the move in plain language —
            which holdings drove it, by how much, and which news was behind it. Trends across 1D to
            all-time. Analytics and education, never advice.
          </p>
          <div className="cta">
            <Link href="/register" className="btn">
              Create your free group
            </Link>
            <Link href="/pricing" className="btn secondary">
              See plans
            </Link>
          </div>

          <div className="card digest-preview">
            <span className="badge">Today&apos;s digest — example</span>
            <p className="headline" style={{ marginTop: 10 }}>
              Your &quot;AI &amp; Chips&quot; group is up +1.4% today, led by NVDA
            </p>
            <p className="dim">
              NVIDIA rose +3.2%, contributing +1.1% of the group&apos;s move (34% of the portfolio).
              Likely driver: NVIDIA tops quarterly earnings estimates, raises full-year guidance
              (MarketWire). Meanwhile TSM slipped −0.8% on sector-wide softness, costing the group
              −0.2%…
            </p>
          </div>
        </section>

        <section className="section">
          <h2>How it works</h2>
          <div className="grid cols-3">
            <div className="card">
              <h3>1 · Build a group</h3>
              <p className="dim">
                Pick your favorite stocks and organize them into groups — a &quot;Chips&quot;
                watchlist, your real holdings, a theme you&apos;re researching.
              </p>
            </div>
            <div className="card">
              <h3>2 · We do the math</h3>
              <p className="dim">
                Every holding&apos;s day move, portfolio weight, and exact contribution to the
                group&apos;s change — computed, not guessed. Trends across 1D, 1W, 1M, 3M, 6M, 1Y,
                5Y, YTD and all-time.
              </p>
            </div>
            <div className="card">
              <h3>3 · AI explains it</h3>
              <p className="dim">
                A daily plain-language digest connects the numbers to the day&apos;s news. No
                predictions, no jargon — just what happened and why.
              </p>
            </div>
          </div>
        </section>
      </div>
      <footer className="site">
        <div className="container">
          TradeMyShow provides analytics and educational content only. Nothing here is investment
          advice, and past performance does not predict future results.
        </div>
      </footer>
    </>
  );
}
