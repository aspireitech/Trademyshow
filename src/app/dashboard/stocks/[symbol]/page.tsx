import { permanentRedirect } from "next/navigation";

/**
 * The stock page moved out of /dashboard and became public.
 *
 * Kept as a redirect rather than deleted: this path is in old digest emails,
 * saved links and alert notifications, and a 404 there would look like the
 * stock had been dropped.
 */
export default async function LegacyStockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  permanentRedirect(`/stocks/${encodeURIComponent(symbol.toUpperCase())}`);
}
