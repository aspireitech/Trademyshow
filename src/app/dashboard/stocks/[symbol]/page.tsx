import StockDetail from "@/components/StockDetail";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <StockDetail symbol={symbol.toUpperCase()} />;
}
