import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://trademyshow.com"),
  title: {
    default: "TradeMyShow — Explainable stock insights with a published track record",
    template: "%s · TradeMyShow",
  },
  description:
    "Daily and weekly stock insights that show their working. Itemised scores, news-driven explanations, and a public record of every past call. Free 14-day trial.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
