import Link from "next/link";
import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { buildTrackRecord } from "@/lib/insight/trackrecord";
import { PLAN_PRICING, TRIAL_DAYS } from "@/lib/plans";
import { UNIVERSE } from "@/lib/marketdata";
import MarketsDashboard from "@/components/MarketsDashboard";
import SiteSidebar from "@/components/SiteSidebar";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "TradeMyShow — Know why your stocks moved, and what usually happens next",
  description:
    "Daily and weekly stock insights that show their working. Every score breaks into parts you can check, every past call is published with what actually happened. Free 14-day trial, no card.",
  keywords: [
    "stock analysis",
    "portfolio insights",
    "daily stock digest",
    "stock score",
    "watchlist analysis",
    "explainable stock analytics",
    "stock news impact",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Know why your stocks moved — and what usually happens next",
    description:
      "Explainable daily and weekly stock insights with a published track record. Free 14-day trial, no card required.",
    type: "website",
    siteName: "TradeMyShow",
  },
  twitter: {
    card: "summary_large_image",
    title: "Know why your stocks moved — and what usually happens next",
    description: "Explainable stock insights with a published track record.",
  },
};

const FAQS = [
  {
    q: "Is this investment advice?",
    a: "No. TradeMyShow publishes analysis and education — scores, explanations and historical base rates. It never tells you what to buy or sell, and it does not manage money or hold funds.",
  },
  {
    q: "How is the Insight Score calculated?",
    a: "It is a weighted composite of four measured components: news sentiment (30%), trend consistency across timeframes (30%), momentum relative to the longer-term pace (25%) and price stability (15%). Every component is shown with its value, weight and a plain-language reason, so you can reconstruct the number yourself.",
  },
  {
    q: "Do you predict prices?",
    a: "No. Instead of a forecast we publish a base rate — how stocks with comparable signals actually behaved afterwards, with the sample size attached. When there is too little history to say anything useful, we say that instead of quoting a number.",
  },
  {
    q: "What happens when the free trial ends?",
    a: `Nothing breaks. After ${TRIAL_DAYS} days the account moves to the Free plan and keeps every watchlist and insight already created. No card is required to start, so there is nothing to cancel.`,
  },
  {
    q: "Where does the data come from?",
    a: "Market prices and company news come from licensed market-data providers. Analysis is computed from that data by our own engine; the AI writes the explanation but never produces the numbers.",
  },
];

export default async function LandingPage() {
  const user = await currentUser();
  const record = buildTrackRecord(30);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "TradeMyShow",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        description: metadata.description,
        offers: {
          "@type": "Offer",
          price: PLAN_PRICING.pro.monthlyUsd,
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="shell">
        <SiteSidebar active="home" />
        <div className="shell-main">
        <nav className="nav">
          <Link href="/" className="brand">
            Trade<span>MyShow</span>
          </Link>
          <div className="links">
          <ThemeToggle />
            <Link href="/track-record">Track record</Link>
            <Link href="/help">Help</Link>
            <Link href="/pricing">Pricing</Link>
            {user ? (
              <Link href="/dashboard" className="btn">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/register" className="btn">
                  Start free
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* A compact band, not a full screen of headline. Someone landing here
            came to look at the market; the pitch has to earn its space beside
            the data rather than push it below the fold. */}
        <header className="hero hero-band">
          <div className="hero-copy rise">
            <p className="pill">
              <span className="live-dot" aria-hidden="true" />
              Insights refresh every market day
            </p>
            <h1>
              Know why your stocks moved —{" "}
              <span className="sweep">and what usually happens next</span>
            </h1>
            <p className="sub">
              Every score breaks into parts you can check, and every call we have made is
              published alongside what actually happened.
            </p>
            <div className="cta">
              <Link href="/register" className="btn">
                Start {TRIAL_DAYS}-day free trial
              </Link>
              <Link href="/track-record" className="btn secondary">
                See the track record
              </Link>
            </div>
            <p className="dim hero-fine">
              No credit card. Full access for {TRIAL_DAYS} days, then a free plan forever.
            </p>
          </div>

          <dl className="hero-proof rise d2">
            <div>
              <dt>Instruments tracked</dt>
              <dd>{UNIVERSE.length}</dd>
            </div>
            <div>
              <dt>Scores graded so far</dt>
              <dd>{record.totalSamples.toLocaleString()}</dd>
            </div>
            <div>
              <dt>30-day hit rate</dt>
              <dd className={record.overallHitRate >= 50 ? "gain" : "loss"}>
                {record.overallHitRate}%
              </dd>
            </div>
            <div>
              <dt>Score components shown</dt>
              <dd>4 of 4</dd>
            </div>
          </dl>
        </header>

        <div className="mkt-wrap rise d3">
          <MarketsDashboard view="gainers" />
        </div>

        <div className="trustbar">
          <span>✓ Every score fully itemised</span>
          <span>✓ Past calls published, hits and misses</span>
          <span>✓ Analytics only — never investment advice</span>
        </div>

        <section className="section">
          <h2>Three things the category gets wrong</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="gap-row">
              <div className="bad">
                <h4>Everyone else</h4>
                <p className="dim" style={{ fontSize: 14 }}>
                  A single AI score appears with no explanation. You cannot tell whether it
                  read the news, the chart, or nothing at all.
                </p>
              </div>
              <div className="good">
                <h4>Here</h4>
                <p style={{ fontSize: 14 }}>
                  The score splits into four weighted components, each with its own number
                  and a sentence explaining it. Add them up and you get the score back.
                </p>
              </div>
            </div>
            <div className="gap-row">
              <div className="bad">
                <h4>Everyone else</h4>
                <p className="dim" style={{ fontSize: 14 }}>
                  Accuracy claims with nothing behind them. No record of past calls, so no
                  way to check whether the score has ever worked.
                </p>
              </div>
              <div className="good">
                <h4>Here</h4>
                <p style={{ fontSize: 14 }}>
                  Every past score is graded against what the stock actually did, and the
                  results are public — including the ones we got wrong.
                </p>
              </div>
            </div>
            <div className="gap-row">
              <div className="bad">
                <h4>Everyone else</h4>
                <p className="dim" style={{ fontSize: 14 }}>
                  Generic market commentary that says nothing about the stocks you actually
                  hold.
                </p>
              </div>
              <div className="good">
                <h4>Here</h4>
                <p style={{ fontSize: 14 }}>
                  Insights are computed on your watchlist: what each holding contributed to
                  your move, ranked by impact, with the news behind it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>What you get, every market day</h2>
          <div className="grid cols-3">
            <div className="card lift">
              <h3>Daily &amp; weekly insight</h3>
              <p className="dim" style={{ fontSize: 14 }}>
                A plain-language read on your watchlist each morning, and a wider view each
                week — what moved, how much each holding contributed, and the news behind it.
              </p>
            </div>
            <div className="card lift">
              <h3>The Insight Score</h3>
              <p className="dim" style={{ fontSize: 14 }}>
                A 0–100 read on signal strength for any stock, itemised into news, trend,
                momentum and stability so you can see exactly what is driving it.
              </p>
            </div>
            <div className="card lift">
              <h3>What usually happens next</h3>
              <p className="dim" style={{ fontSize: 14 }}>
                Not a forecast — a base rate. How stocks with comparable signals actually
                behaved over the following 7, 30 and 90 days, with the sample size shown.
              </p>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>We publish our record. All of it.</h2>
          <p className="dim" style={{ maxWidth: "64ch", marginBottom: 20 }}>
            These numbers are generated from the same engine that scores your stocks — not a
            marketing claim, and not curated. If the score stops working, this is where you
            will see it first.
          </p>
          <div className="grid cols-3">
            <div className="card lift">
              <p className="dim" style={{ fontSize: 13 }}>Scores graded</p>
              <p className="mono" style={{ fontSize: 30, fontWeight: 700 }}>
                {record.totalSamples.toLocaleString()}
              </p>
            </div>
            <div className="card lift">
              <p className="dim" style={{ fontSize: 13 }}>Directional hit rate · 30d</p>
              <p className="mono" style={{ fontSize: 30, fontWeight: 700 }}>
                {record.overallHitRate.toFixed(1)}%
              </p>
            </div>
            <div className="card lift">
              <p className="dim" style={{ fontSize: 13 }}>Updated</p>
              <p className="mono" style={{ fontSize: 30, fontWeight: 700 }}>
                {record.generatedAt}
              </p>
            </div>
          </div>
          <p style={{ marginTop: 18 }}>
            <Link href="/track-record">See the full breakdown by score band →</Link>
          </p>
        </section>

        <section className="section">
          <h2>Straightforward pricing</h2>
          <p className="dim" style={{ marginBottom: 20 }}>
            Start with {TRIAL_DAYS} days of Pro, no card. Keep a free plan afterwards.
          </p>
          <div className="grid cols-3">
            <div className="card lift">
              <span className="badge">Free</span>
              <p className="price" style={{ marginTop: 10 }}>
                $0 <small>forever</small>
              </p>
              <ul className="features">
                <li>1 watchlist, 5 stocks</li>
                <li>Daily insight</li>
                <li>Score band for any stock</li>
                <li>All nine timeframes</li>
              </ul>
            </div>
            <div className="card lift" style={{ borderColor: "var(--accent)" }}>
              <span className="badge">Pro · most popular</span>
              <p className="price" style={{ marginTop: 10 }}>
                ${PLAN_PRICING.pro.monthlyUsd} <small>/ month</small>
              </p>
              <ul className="features">
                <li>10 watchlists, 30 stocks each</li>
                <li>Daily + weekly insight</li>
                <li>Exact scores with full breakdown</li>
                <li>Historical base rates</li>
                <li>Email delivery</li>
              </ul>
            </div>
            <div className="card lift">
              <span className="badge">Premium</span>
              <p className="price" style={{ marginTop: 10 }}>
                ${PLAN_PRICING.premium.monthlyUsd} <small>/ month</small>
              </p>
              <ul className="features">
                <li>Effectively unlimited watchlists</li>
                <li>Everything in Pro</li>
                <li>Deepest per-holding analysis</li>
                <li>Priority processing</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: 18 }}>
            <Link href="/pricing">Compare plans in detail →</Link>
          </p>
        </section>

        <section className="section faq">
          <h2>Questions</h2>
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="section" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 10 }}>See tomorrow&apos;s insight on your own watchlist</h2>
          <p className="dim" style={{ marginBottom: 22 }}>
            Add a few stocks and your first insight is ready in under a minute.
          </p>
          <Link href="/register" className="btn" style={{ padding: "12px 26px", fontSize: 15 }}>
            Start {TRIAL_DAYS}-day free trial
          </Link>
        </section>
      </div>
      </div>

      <footer className="site">
        <div className="container">
          TradeMyShow provides analytics and educational content only. <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> Nothing here is
          investment advice or a recommendation to buy or sell any security. Past performance
          does not predict future results. <Link href="/terms">Terms</Link> ·{" "}
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </>
  );
}
