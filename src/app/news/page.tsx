import type { Metadata } from "next";
import NewsPanel from "@/components/NewsPanel";
import NewsletterSignup from "@/components/NewsletterSignup";
import SiteShell from "@/components/SiteShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market news",
  description:
    "Headlines across the instruments we track, each one attached to the stock it concerns and to the day's move it helps explain.",
  alternates: { canonical: "/news" },
};

export default function NewsPage() {
  return (
    <SiteShell active="news">
      <div className="board-intro">
        <div>
          <h1>Market news</h1>
          <p className="dim">
            Headlines attached to the stock they concern, so the story and the move sit side by
            side. Open any symbol for the price behind the headline.
          </p>
        </div>
      </div>
      <NewsPanel limit={24} />
      <NewsletterSignup source="news" />
    </SiteShell>
  );
}
