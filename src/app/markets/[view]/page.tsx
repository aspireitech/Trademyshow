import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketsDashboard from "@/components/MarketsDashboard";
import NewsletterSignup from "@/components/NewsletterSignup";
import SiteShell from "@/components/SiteShell";
import { VIEW_LABELS, type MoverView } from "@/lib/insight/movers";

const VIEWS = Object.keys(VIEW_LABELS) as MoverView[];

// Rendered per request: a statically generated screen would freeze the whole
// market at whatever the build day happened to be, and the sidebar could
// never show the visitor's own watchlists.
export const dynamic = "force-dynamic";

const BLURB: Record<MoverView, string> = {
  gainers: "The biggest risers of the session, ranked by percentage move.",
  losers: "The biggest fallers of the session, ranked by percentage move.",
  active: "The largest moves in either direction — where the day's action was.",
  high52: "Trading closest to their highest price of the past year.",
  low52: "Trading closest to their lowest price of the past year.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  const label = VIEW_LABELS[view as MoverView];
  if (!label) return { title: "Markets" };
  return {
    title: label,
    description: `${BLURB[view as MoverView]} Volume, market cap, a one-month trend and an itemised signal reading beside every row.`,
    alternates: { canonical: `/markets/${view}` },
  };
}

export default async function MarketsPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!VIEWS.includes(view as MoverView)) notFound();
  const key = view as MoverView;

  return (
    <SiteShell active={key} wide>
      <div className="board-intro">
        <div>
          <h1>{VIEW_LABELS[key]}</h1>
          <p className="dim">{BLURB[key]}</p>
        </div>
      </div>
      <MarketsDashboard view={key} />
      <NewsletterSignup source={`markets-${key}`} />
    </SiteShell>
  );
}
