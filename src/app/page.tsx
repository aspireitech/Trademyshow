import Link from "next/link";
import type { Metadata } from "next";
import { buildTrackRecord } from "@/lib/insight/trackrecord";
import { PLAN_PRICING, TRIAL_DAYS } from "@/lib/plans";
import { UNIVERSE } from "@/lib/marketdata";
import { VIEW_LABELS, type MoverView } from "@/lib/insight/movers";
import MarketsDashboard from "@/components/MarketsDashboard";
import NewsPanel from "@/components/NewsPanel";
import NewsletterSignup from "@/components/NewsletterSignup";
import SiteShell from "@/components/SiteShell";

/**
 * The home page is the market dashboard.
 *
 * Someone arriving at a stock site came to look at the market, not to read a
 * pitch — so the screens are the page, the tabs switch between them in place,
 * and the argument for signing up sits underneath where it can be read by
 * anyone who liked what they saw. The old order (a screen of headline, then
 * data) was answering a question nobody had asked yet.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TradeMyShow — Market movers, 52-week screens and explainable stock scores",
  description:
    "Top gainers, losers, biggest moves and 52-week highs and lows across 150+ instruments, with an itemised signal reading beside every row. Search any ticker for its price, chart and full breakdown. Free.",
  keywords: [
    "top gainers today",
    "top losers today",
    "52 week high stocks",
    "52 week low stocks",
    "stock screener",
    "stock analysis",
    "market movers",
    "explainable stock analytics",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Market movers, 52-week screens and explainable stock scores",
    description:
      "Every screen a stock site should open with, plus a score that breaks into parts you can check.",
    type: "website",
    siteName: "TradeMyShow",
  },
  twitter: {
    card: "summary_large_image",
    title: "Market movers and explainable stock scores",
    description: "Explainable stock insights with a published track record.",
  },
};

const FAQS = [
  {
    q: "Is this investment advice?",
    a: "No. TradeMyShow publishes analysis and education — scores, explanations and historical base rates. It never tells you what to buy or sell, and it does not manage money or hold funds.",
  },
  {
    q: "Where does the price data come from?",
    a: "Live prices come from public market-data endpoints (Yahoo Finance, with Stooq's end-of-day files as a backstop) and are refreshed into our own cache. Quotes may be delayed. Every screen labels what it is showing, and where no real quote reached us the figure is marked as simulated rather than passed off as a price.",
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
];

const VIEWS = Object.keys(VIEW_LABELS) as MoverView[];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: requested } = await searchParams;
  const view: MoverView = VIEWS.includes(requested as MoverView)
    ? (requested as MoverView)
    : "gainers";

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
    <SiteShell active={view === "gainers" ? "home" : view} wide>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="board-intro">
        <div>
          <h1>Markets today</h1>
          <p className="dim">
            {UNIVERSE.length} instruments, ranked by what already happened — never by what we
            think will happen next. Search any ticker above for its full page.
          </p>
        </div>
        <dl className="board-proof">
          <div>
            <dt>Scores graded</dt>
            <dd>{record.totalSamples.toLocaleString()}</dd>
          </div>
          <div>
            <dt>30-day hit rate</dt>
            <dd className={record.overallHitRate >= 50 ? "gain" : "loss"}>
              {record.overallHitRate}%
            </dd>
          </div>
          <div>
            <dt>Components shown</dt>
            <dd>4 of 4</dd>
          </div>
        </dl>
      </div>

      <MarketsDashboard view={view} basePath="/" />

      <NewsPanel />

      <NewsletterSignup source="landing" />

      <div className="trustbar">
        <span>✓ Every score fully itemised</span>
        <span>✓ Past calls published, hits and misses</span>
        <span>✓ Analytics only — never investment advice</span>
      </div>

      <section className="section">
        <h2>What you get, free, before anyone asks for a card</h2>
        <div className="grid cols-3">
          <div className="card lift">
            <h3>Every screen, all 50 rows</h3>
            <p className="dim" style={{ fontSize: 14 }}>
              Gainers, losers, biggest moves and both 52-week screens, with volume, market cap
              and a month of trend beside each row.
            </p>
          </div>
          <div className="card lift">
            <h3>Any ticker, in full</h3>
            <p className="dim" style={{ fontSize: 14 }}>
              Price, day and 52-week ranges, nine timeframes of return, the chart and the
              headlines — for anything listed, not just the names we ship.
            </p>
          </div>
          <div className="card lift">
            <h3>A watchlist and alerts</h3>
            <p className="dim" style={{ fontSize: 14 }}>
              Keep what you follow, and be told when a price or a signal crosses the line you
              set. A free account, no card.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Three things the category gets wrong</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="gap-row">
            <div className="bad">
              <h4>Everyone else</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                A single AI score appears with no explanation. You cannot tell whether it read
                the news, the chart, or nothing at all.
              </p>
            </div>
            <div className="good">
              <h4>Here</h4>
              <p style={{ fontSize: 14 }}>
                The score splits into four weighted components, each with its own number and a
                sentence explaining it. Add them up and you get the score back.
              </p>
            </div>
          </div>
          <div className="gap-row">
            <div className="bad">
              <h4>Everyone else</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                Accuracy claims with nothing behind them. No record of past calls, so no way to
                check whether the score has ever worked.
              </p>
            </div>
            <div className="good">
              <h4>Here</h4>
              <p style={{ fontSize: 14 }}>
                Every past score is graded against what the stock actually did, and the results
                are public — including the ones we got wrong.
              </p>
            </div>
          </div>
          <div className="gap-row">
            <div className="bad">
              <h4>Everyone else</h4>
              <p className="dim" style={{ fontSize: 14 }}>
                A price with no provenance. You cannot tell whether it is live, delayed by
                twenty minutes, or last Friday&apos;s close.
              </p>
            </div>
            <div className="good">
              <h4>Here</h4>
              <p style={{ fontSize: 14 }}>
                Every price carries its source and its age, and anything we could not source is
                marked as simulated rather than dressed up as a quote.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Straightforward pricing</h2>
        <p className="dim" style={{ marginBottom: 20 }}>
          Start with {TRIAL_DAYS} days of Pro, no card. Keep a free plan afterwards.
        </p>
        <div className="grid cols-3">
          <div className="card lift">
            <span className="badge">Free</span>
            <p className="price" style={{ marginTop: 10 }}>$0 <small>forever</small></p>
            <ul className="features">
              <li>1 watchlist, 5 stocks</li>
              <li>3 price or score alerts</li>
              <li>Daily insight</li>
              <li>Score band for any stock</li>
            </ul>
          </div>
          <div className="card lift" style={{ borderColor: "var(--accent)" }}>
            <span className="badge">Pro · most popular</span>
            <p className="price" style={{ marginTop: 10 }}>
              ${PLAN_PRICING.pro.monthlyUsd} <small>/ month</small>
            </p>
            <ul className="features">
              <li>10 watchlists, 30 stocks each</li>
              <li>20 alerts</li>
              <li>Exact scores with full breakdown</li>
              <li>Historical base rates</li>
              <li>Full 52-week screens</li>
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
              <li>CSV export</li>
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
        <h2 style={{ marginBottom: 10 }}>Put your own holdings on this board</h2>
        <p className="dim" style={{ marginBottom: 22 }}>
          Add a few stocks and your first insight is ready in under a minute.
        </p>
        <Link href="/register" className="btn" style={{ padding: "12px 26px", fontSize: 15 }}>
          Start {TRIAL_DAYS}-day free trial
        </Link>
      </section>
    </SiteShell>
  );
}
