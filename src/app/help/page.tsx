import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { articleCount, HELP } from "@/lib/help";

export const metadata: Metadata = {
  title: "Help centre",
  description:
    "How the Insight Score is calculated, where the data comes from, why this is analysis rather than advice, and how to manage your account.",
};

/**
 * Server-rendered with every answer in the HTML.
 *
 * A help centre that needs JavaScript to reveal its answers is invisible to
 * search engines and to anyone on a bad connection — and these particular
 * answers, about advice and accuracy, are ones we want findable.
 */
export default function HelpPage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HELP.flatMap((c) =>
      c.articles.map((a) => ({
        "@type": "Question",
        name: a.q,
        acceptedAnswer: { "@type": "Answer", text: a.a.join(" ") },
      })),
    ),
  };

  return (
    <div className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <nav className="nav">
        <Link href="/" className="brand">Trade<span>MyShow</span></Link>
        <div className="links">
          <ThemeToggle />
          <Link href="/track-record">Track record</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Log in</Link>
        </div>
      </nav>

      <main style={{ padding: "30px 0 70px" }}>
        <h1 style={{ marginBottom: 6 }}>Help centre</h1>
        <p className="dim" style={{ maxWidth: "62ch", marginBottom: 22 }}>
          {articleCount()} answers, starting with the ones worth asking before you trust any
          analysis: what this is, what it is not, and where the numbers come from.
        </p>

        <div className="help-cats">
          {HELP.map((c) => (
            <a key={c.id} href={`#${c.id}`} className="help-cat">
              <strong>{c.title}</strong>
              <span className="dim">{c.blurb}</span>
              <span className="help-count">{c.articles.length} articles</span>
            </a>
          ))}
        </div>

        {HELP.map((c) => (
          <section key={c.id} id={c.id} className="help-section">
            <h2>{c.title}</h2>
            {c.articles.map((a) => (
              <details key={a.q} className="help-item">
                <summary>{a.q}</summary>
                <div className="help-answer">
                  {a.a.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            ))}
          </section>
        ))}

        <section className="card" style={{ marginTop: 30 }}>
          <h3>Still stuck?</h3>
          <p className="dim" style={{ fontSize: 14 }}>
            Write to <strong>support@trademyshow.com</strong> from the address on your account and
            we will come back to you. There is a person at the other end.
          </p>
          <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>
            One thing we cannot help with: whether to buy or sell anything. That is not a policy
            about support — it is what this product is and is not. For decisions about your own
            money, speak to someone licensed to advise in your country.
          </p>
        </section>
      </main>
    </div>
  );
}
