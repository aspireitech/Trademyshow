import Link from "next/link";
import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What TradeMyShow collects, why, and the control you have over it.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "19 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <div className="container">
        <nav className="nav">
          <Link href="/" className="brand">Trade<span>MyShow</span></Link>
          <div className="links"><ThemeToggle /><Link href="/terms">Terms</Link></div>
        </nav>
        <article className="legal">
          <h1>Privacy Policy</h1>
          <p className="dim">Last updated {UPDATED}</p>

          <div className="callout">
            <strong>Template — not yet reviewed by a lawyer.</strong> It describes what the
            software actually does today, but a qualified lawyer should review it before
            launch, particularly if you serve the EU, UK or California.
          </div>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account</strong> — name, email, hashed password. Passwords are hashed with bcrypt and never stored or logged in the clear.</li>
            <li><strong>Your content</strong> — the watchlists you build, the stocks in them, and the insights generated for you.</li>
            <li><strong>Session records</strong> — a session identifier, browser user-agent, and a <em>salted hash</em> of your IP address. We do not store raw IP addresses.</li>
            <li><strong>Product events</strong> — a small set of named actions (for example &quot;insight generated&quot;) used to understand which features are used. Collected first-party; no third-party analytics script runs on this site.</li>
            <li><strong>Payment</strong> — handled by Stripe. Card details never touch our servers; we store only a customer reference.</li>
          </ul>

          <h2>Why we collect it</h2>
          <p>
            To run your account and produce your insights (performance of our contract with
            you), to keep the service secure and prevent abuse (legitimate interest), and to
            send the emails you asked for (consent, withdrawable at any time).
          </p>

          <h2>AI processing</h2>
          <p>
            Your watchlist facts — symbols, percentage changes and related headlines — are
            sent to an AI provider to write the plain-language explanation. Your name, email
            and password are never included. Providers may be Google, Anthropic or OpenAI
            depending on availability. If no provider is configured, the explanation is
            generated locally instead.
          </p>

          <h2>Sharing</h2>
          <p>
            We do not sell your personal data. We share it only with the processors needed
            to run the service: our hosting provider, Stripe for payment, an email delivery
            provider, and the AI provider described above.
          </p>

          <h2>Retention</h2>
          <p>
            Account data is kept while your account exists. Deleting your account removes
            your profile, watchlists, insights, alerts and sessions immediately. Security
            audit entries are retained without a user reference so we can investigate past
            incidents.
          </p>

          <h2>Your rights</h2>
          <p>
            You can export everything we hold about you as JSON, and delete your account
            permanently, from your account settings — both take effect immediately and
            neither requires contacting us. You may also object to processing or lodge a
            complaint with your data protection authority.
          </p>

          <h2>Cookies</h2>
          <p>
            We set two: a signed session cookie that keeps you logged in, and a CSRF token
            that protects against cross-site request forgery. Both are strictly necessary.
            We set no advertising or tracking cookies.
          </p>

          <h2>Contact</h2>
          <p>Privacy questions or requests: <span className="mono">privacy@trademyshow.com</span></p>
        </article>
      </div>
      <footer className="site"><div className="container">Analytics and educational content only — never investment advice.</div></footer>
    </>
  );
}
