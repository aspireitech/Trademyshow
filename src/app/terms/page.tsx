import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LEGAL_CONFIG,
  TERMS_SECTIONS,
  TERMS_SUMMARY,
  TERMS_VERSION,
  unresolvedLegalPlaceholders,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and TradeMyShow: what the service is, what it is not, and how liability and disputes are handled.",
};

/**
 * Rendered from the same TERMS_SECTIONS the signed PDF is built from, so the
 * page a user reads and the record of what they accepted cannot diverge.
 */
export default function TermsPage() {
  const missing = unresolvedLegalPlaceholders();

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/" className="brand">
          Trade<span>MyShow</span>
        </Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Log in</Link>
        </div>
      </nav>

      <main className="legal" style={{ padding: "30px 0 70px" }}>
        <h1>Terms of Service</h1>
        <p className="dim" style={{ fontSize: 13 }}>
          Version <span className="mono">{TERMS_VERSION}</span> · effective 19 August 2026
        </p>

        <div className="callout" style={{ margin: "18px 0" }}>
          <strong>Template — not yet reviewed by a lawyer.</strong>{" "}
          <span className="dim">
            This wording is a starting point drafted alongside the product. It must be reviewed by
            a qualified securities lawyer in the operating jurisdiction before the service takes
            payment.
          </span>
          {missing.length > 0 && (
            <p className="error" style={{ marginTop: 8, fontSize: 13 }}>
              Unset legal values: <span className="mono">{missing.join(", ")}</span>. These appear
              as placeholders below and must be configured before launch.
            </p>
          )}
        </div>

        <section className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>The short version</h3>
          <p className="dim" style={{ fontSize: 13, marginBottom: 10 }}>
            A plain-language summary. It does not replace the full terms below, and where the two
            differ the full terms apply.
          </p>
          <ul style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
            {TERMS_SUMMARY.map((s) => (
              <li key={s} style={{ fontSize: 14 }}>
                {s}
              </li>
            ))}
          </ul>
        </section>

        {TERMS_SECTIONS.map((section) => (
          <section key={section.heading} style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 17 }}>{section.heading}</h2>
            {section.paragraphs.map((p, i) =>
              p.startsWith("• ") ? (
                <p key={i} style={{ paddingLeft: 16, marginTop: 4 }}>
                  {p}
                </p>
              ) : (
                <p key={i} style={{ marginTop: 8 }}>
                  {p}
                </p>
              ),
            )}
          </section>
        ))}

        <p className="dim" style={{ fontSize: 12, marginTop: 30 }}>
          {LEGAL_CONFIG.companyName} · {LEGAL_CONFIG.address} · {LEGAL_CONFIG.contactEmail}
        </p>
      </main>
    </div>
  );
}
