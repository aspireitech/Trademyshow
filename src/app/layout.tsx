import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { THEME_BOOTSTRAP } from "@/lib/csp";
import SandboxBanner from "@/components/SandboxBanner";
import SignupPrompt from "@/components/SignupPrompt";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies a stored theme choice before first paint, so an explicit
            dark preference never flashes light. Absent a choice, the CSS
            follows prefers-color-scheme on its own. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <SandboxBanner />
        {children}
        <SignupPrompt />
      </body>
    </html>
  );
}
