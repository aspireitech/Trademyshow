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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies a stored theme choice before first paint, so an explicit
            dark preference never flashes light. Absent a choice, the CSS
            follows prefers-color-scheme on its own. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
