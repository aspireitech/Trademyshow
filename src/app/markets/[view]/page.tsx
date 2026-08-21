import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarketsDashboard from "@/components/MarketsDashboard";
import SiteSidebar from "@/components/SiteSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import { VIEW_LABELS, type MoverView } from "@/lib/insight/movers";

const VIEWS = Object.keys(VIEW_LABELS) as MoverView[];

// Rendered per request: a statically generated screen would freeze the whole
// market at whatever the build day happened to be, and the sidebar could
// never show the visitor's own watchlists.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ view: string }>;
}): Promise<Metadata> {
  const { view } = await params;
  const label = VIEW_LABELS[view as MoverView];
  return {
    title: label ?? "Markets",
    description: `${label ?? "Market screens"} across every stock, fund and coin we track — with a one-month trend and the signal reading beside each row.`,
  };
}

export default async function MarketsPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (!VIEWS.includes(view as MoverView)) notFound();

  return (
    <div className="shell">
      <SiteSidebar active={view} />
      <div className="shell-main">
        <nav className="nav">
          <Link href="/" className="brand">Trade<span>MyShow</span></Link>
          <div className="links">
            <ThemeToggle />
            <Link href="/track-record">Track record</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Log in</Link>
            <Link href="/register" className="btn">Start free</Link>
          </div>
        </nav>
        <main style={{ padding: "22px 0 60px" }}>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>{VIEW_LABELS[view as MoverView]}</h1>
          <p className="dim" style={{ fontSize: 14, marginBottom: 18 }}>
            Everything we track, ranked by what already happened today.
          </p>
          <MarketsDashboard view={view as MoverView} />
        </main>
      </div>
    </div>
  );
}
