import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteShell from "@/components/SiteShell";
import FullChart from "@/components/stock/FullChart";
import { getStockInfo } from "@/lib/marketdata";
import { resolveSymbol } from "@/lib/providers/feed";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${decodeURIComponent(symbol).toUpperCase()} chart` };
}

export default async function ChartPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const info = getStockInfo(decodeURIComponent(symbol)) ?? (await resolveSymbol(symbol));
  if (!info) notFound();

  return (
    <SiteShell active="markets" wide>
      <p style={{ marginBottom: 8 }}>
        <Link href={`/stocks/${info.symbol}`} className="dim">← {info.symbol} overview</Link>
      </p>
      <h1 style={{ fontSize: 24, marginBottom: 2 }}>
        {info.name} <span className="dim" style={{ fontWeight: 400 }}>({info.symbol})</span>
      </h1>
      <p className="dim" style={{ fontSize: 13, marginBottom: 14 }}>{info.sector}</p>
      <FullChart symbol={info.symbol} />
    </SiteShell>
  );
}
