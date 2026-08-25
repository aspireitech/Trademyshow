import type { Metadata } from "next";
import Link from "next/link";
import PortfolioOverview from "@/components/PortfolioOverview";

export const metadata: Metadata = { title: "Portfolio", robots: { index: false, follow: false } };

export default function PortfolioPage() {
  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard" className="dim">← Dashboard</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>Portfolio</h2>
      <p className="dim" style={{ fontSize: 14, marginBottom: 20, maxWidth: "62ch" }}>
        Every watchlist with share counts entered becomes a priced portfolio here — one number
        for everything you hold, and one for each list on its own.
      </p>
      <PortfolioOverview />
    </>
  );
}
