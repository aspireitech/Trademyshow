import Link from "next/link";
import type { Metadata } from "next";
import { PLAN_LIMITS, PLAN_PRICING, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Plans from free to $${PLAN_PRICING.premium.monthlyUsd}/month. Start with ${TRIAL_DAYS} days of Pro — no credit card, nothing to cancel.`,
  alternates: { canonical: "/pricing" },
};

const yes = "✓";
const no = "—";

const ROWS: { label: string; free: string; pro: string; premium: string }[] = [
  {
    label: "Watchlists",
    free: String(PLAN_LIMITS.free.maxGroups),
    pro: String(PLAN_LIMITS.pro.maxGroups),
    premium: "Unlimited*",
  },
  {
    label: "Stocks per watchlist",
    free: String(PLAN_LIMITS.free.maxHoldingsPerGroup),
    pro: String(PLAN_LIMITS.pro.maxHoldingsPerGroup),
    premium: String(PLAN_LIMITS.premium.maxHoldingsPerGroup),
  },
  { label: "Daily insight", free: yes, pro: yes, premium: yes },
  { label: "Weekly insight", free: no, pro: yes, premium: yes },
  { label: "Per-holding breakdown", free: no, pro: yes, premium: yes },
  { label: "Exact Insight Score", free: "Band only", pro: yes, premium: yes },
  { label: "Component breakdown", free: no, pro: yes, premium: yes },
  { label: "Historical base rates", free: no, pro: yes, premium: yes },
  { label: "Email delivery", free: no, pro: yes, premium: yes },
  { label: "All nine timeframes", free: yes, pro: yes, premium: yes },
  { label: "Public track record", free: yes, pro: yes, premium: yes },
  { label: "Priority processing", free: no, pro: no, premium: yes },
];

export default function PricingPage() {
  return (
    <>
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">
            Trade<span>MyShow</span>
          </Link>
          <div className="links">
            <Link href="/track-record">Track record</Link>
            <Link href="/login">Log in</Link>
            <Link href="/register" className="btn">
              Start free
            </Link>
          </div>
        </nav>

        <section className="section" style={{ borderTop: "none", textAlign: "center" }}>
          <h2 className="rise" style={{ fontSize: 32 }}>
            Start free. Upgrade when it earns it.
          </h2>
          <p className="dim rise d1" style={{ maxWidth: "56ch", margin: "0 auto 8px" }}>
            Every account begins with {TRIAL_DAYS} days of Pro. No card, so there is nothing to
            cancel — when the trial ends you simply move to the free plan and keep your data.
          </p>
        </section>

        <section style={{ paddingBottom: 40 }}>
          <div className="grid cols-3">
            <div className="card lift rise d1">
              <span className="badge">Free</span>
              <p className="price" style={{ marginTop: 10 }}>
                $0 <small>forever</small>
              </p>
              <p className="dim" style={{ fontSize: 13, minHeight: 40 }}>
                Enough to follow one watchlist and see whether the insights are worth reading.
              </p>
              <ul className="features">
                <li>1 watchlist, {PLAN_LIMITS.free.maxHoldingsPerGroup} stocks</li>
                <li>Daily insight</li>
                <li>Score band for any stock</li>
                <li>All nine timeframes</li>
              </ul>
              <Link href="/register" className="btn secondary" style={{ width: "100%", textAlign: "center" }}>
                Create free account
              </Link>
            </div>

            <div className="card lift rise d2" style={{ borderColor: "var(--accent)" }}>
              <span className="badge">Pro · most popular</span>
              <p className="price" style={{ marginTop: 10 }}>
                ${PLAN_PRICING.pro.monthlyUsd} <small>/ month</small>
              </p>
              <p className="dim" style={{ fontSize: 13, minHeight: 40 }}>
                ${PLAN_PRICING.pro.annualUsd}/year billed annually — about {PLAN_PRICING.pro.annualSavingPct}% off.
                For anyone actually following a portfolio.
              </p>
              <ul className="features">
                <li>{PLAN_LIMITS.pro.maxGroups} watchlists, {PLAN_LIMITS.pro.maxHoldingsPerGroup} stocks each</li>
                <li>Daily + weekly insight</li>
                <li>Exact scores, fully itemised</li>
                <li>Historical base rates</li>
                <li>Email delivery</li>
              </ul>
              <Link href="/register" className="btn" style={{ width: "100%", textAlign: "center" }}>
                Start {TRIAL_DAYS}-day trial
              </Link>
            </div>

            <div className="card lift rise d3">
              <span className="badge">Premium</span>
              <p className="price" style={{ marginTop: 10 }}>
                ${PLAN_PRICING.premium.monthlyUsd} <small>/ month</small>
              </p>
              <p className="dim" style={{ fontSize: 13, minHeight: 40 }}>
                ${PLAN_PRICING.premium.annualUsd}/year billed annually. For people tracking many
                positions across several strategies.
              </p>
              <ul className="features">
                <li>Effectively unlimited watchlists</li>
                <li>Everything in Pro</li>
                <li>Deepest per-holding analysis</li>
                <li>Priority processing</li>
              </ul>
              <Link href="/register" className="btn secondary" style={{ width: "100%", textAlign: "center" }}>
                Start {TRIAL_DAYS}-day trial
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Compare every feature</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="holdings">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Free</th>
                  <th>Pro</th>
                  <th>Premium</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className={r.free === no ? "dim" : ""}>{r.free}</td>
                    <td className={r.pro === no ? "dim" : ""}>{r.pro}</td>
                    <td className={r.premium === no ? "dim" : ""}>{r.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
            *Fair-use ceiling of {PLAN_LIMITS.premium.maxGroups} watchlists.
          </p>
        </section>

        <section className="section" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 10 }}>Check the record before you pay</h2>
          <p className="dim" style={{ marginBottom: 20 }}>
            Our scoring history is public, including the calls that did not work.
          </p>
          <Link href="/track-record" className="btn secondary">
            See the track record
          </Link>
        </section>
      </div>

      <footer className="site">
        <div className="container">
          Analytics and educational content only — never investment advice. Prices in USD.
        </div>
      </footer>
    </>
  );
}
