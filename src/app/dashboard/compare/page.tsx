import type { Metadata } from "next";
import Link from "next/link";
import CompareChart from "@/components/CompareChart";

export const metadata: Metadata = { title: "Compare", robots: { index: false, follow: false } };

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ symbols?: string }>;
}) {
  const { symbols } = await searchParams;
  // Defaults to a stock against the index it lives in, which is the comparison
  // that actually answers "was that the company or the market?"
  const initial = symbols ? symbols.split(",").filter(Boolean) : ["NVDA", "SPY"];

  return (
    <>
      <p style={{ marginBottom: 8 }}>
        <Link href="/dashboard" className="dim">← Dashboard</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>Compare instruments</h2>
      <p className="dim" style={{ fontSize: 14, marginBottom: 20, maxWidth: "62ch" }}>
        Most of the time a holding moved because its sector or the whole market moved. Put them on
        one axis and that becomes visible in a second.
      </p>
      <CompareChart initial={initial} />
    </>
  );
}
