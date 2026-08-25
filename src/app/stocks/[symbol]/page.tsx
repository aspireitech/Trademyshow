import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteShell from "@/components/SiteShell";
import StockView from "@/components/stock/StockView";
import { getStockInfo } from "@/lib/marketdata";
import { resolveSymbol } from "@/lib/providers/feed";

/**
 * The public stock page.
 *
 * Public on purpose. It used to live under /dashboard, which meant a visitor
 * could not look at a single stock without an account — so the product could
 * not be judged before signing up, and search results led to a login screen.
 * The paywall now sits where it belongs: on the exact score, not on the page.
 */

export const dynamic = "force-dynamic";

async function lookup(raw: string) {
  const symbol = decodeURIComponent(raw).toUpperCase();
  return getStockInfo(symbol) ?? (await resolveSymbol(symbol));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const info = await lookup(symbol);
  if (!info) return { title: `${symbol.toUpperCase()} — not found` };
  return {
    title: `${info.symbol} — ${info.name} price, chart and signal reading`,
    description: `${info.name} (${info.symbol}): price, day and 52-week ranges, volume, trend across nine timeframes, and an itemised signal reading you can check line by line.`,
    alternates: { canonical: `/stocks/${info.symbol}` },
  };
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const info = await lookup(symbol);
  if (!info) notFound();

  return (
    <SiteShell active="markets">
      <StockView symbol={info.symbol} />
    </SiteShell>
  );
}
