import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeMyShow — Know why your portfolio moved today",
  description:
    "AI-explained daily digests for your watchlist groups. Multi-timeframe trends, news-to-portfolio impact, plain-language analysis. Not investment advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
