import Link from "next/link";
import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import { TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing use of TradeMyShow.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "19 August 2026";

export default function TermsPage() {
  return (
    <>
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">Trade<span>MyShow</span></Link>
          <div className="links"><ThemeToggle /><Link href="/privacy">Privacy</Link></div>
        </nav>
        <article className="legal">
          <h1>Terms of Service</h1>
          <p className="dim">Last updated {UPDATED}</p>

          <div className="callout">
            <strong>Template — not yet reviewed by a lawyer.</strong> This is a working
            draft covering the obvious ground. Have a qualified lawyer in your operating
            jurisdiction review it before you accept payment from anyone.
          </div>

          <h2>1. What TradeMyShow is</h2>
          <p>
            TradeMyShow publishes analytics and educational content about publicly traded
            securities: computed scores, plain-language explanations of price movement, and
            historical base rates. It is an information service.
          </p>

          <h2>2. What TradeMyShow is not</h2>
          <p>
            <strong>Nothing on this service is investment advice, a recommendation, or an
            offer to buy or sell any security.</strong> We are not an investment adviser,
            broker-dealer, or financial planner. We do not know your circumstances, and
            nothing we publish is tailored to them. We never take custody of your money or
            securities, and we do not execute trades.
          </p>
          <p>
            Any decision you make with your money is yours alone. Past performance does not
            predict future results, and every figure we publish can be wrong.
          </p>

          <h2>3. Your account</h2>
          <p>
            You must be at least 18 and provide accurate information. You are responsible
            for your credentials and for activity under your account. Tell us promptly if
            you believe your account has been compromised.
          </p>

          <h2>4. Plans, trial and payment</h2>
          <p>
            New accounts receive {TRIAL_DAYS} days of Pro features with no card required.
            When the trial ends the account reverts to the Free plan; nothing is charged and
            there is nothing to cancel. Paid subscriptions renew automatically until
            cancelled, and you can cancel at any time from your account — access continues
            until the end of the paid period. Prices are in US dollars and exclude any tax
            we are required to collect.
          </p>

          <h2>5. Acceptable use</h2>
          <p>
            Do not scrape or redistribute our data at scale, resell the service, attempt to
            breach its security, or use it to build a competing dataset. We may suspend an
            account that does.
          </p>

          <h2>6. Data accuracy</h2>
          <p>
            Market and news data come from third-party providers. We do not warrant that any
            of it is accurate, complete or timely, and the service is provided &quot;as
            is&quot; without warranties of any kind.
          </p>

          <h2>7. Limitation of liability</h2>
          <p>
            To the maximum extent the law allows, we are not liable for any trading or
            investment losses, lost profits, or indirect or consequential damages. Our total
            liability for any claim is limited to what you paid us in the twelve months
            before it arose.
          </p>

          <h2>8. Changes and termination</h2>
          <p>
            We may change these terms and will update the date above; material changes will
            be notified by email. You may close your account at any time from your account
            settings, which permanently deletes your data.
          </p>

          <h2>9. Contact</h2>
          <p>Questions about these terms: <span className="mono">legal@trademyshow.com</span></p>
        </article>
      </div>
      <footer className="site"><div className="container">Analytics and educational content only — never investment advice.</div></footer>
    </>
  );
}
