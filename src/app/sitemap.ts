import type { MetadataRoute } from "next";
import { UNIVERSE } from "@/lib/marketdata";
import { VIEW_LABELS, type MoverView } from "@/lib/insight/movers";

const BASE = process.env.SITE_URL ?? "https://trademyshow.com";

/**
 * The sitemap grew because the site did.
 *
 * Stock pages are public now, and a public page nobody can find through search
 * may as well be behind the login it just came out from. One entry per tracked
 * instrument, plus the five market screens — those are the pages people arrive
 * on from a query like "AMZN price" or "52 week low stocks".
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const views = Object.keys(VIEW_LABELS) as MoverView[];

  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...views.map((v) => ({
      url: `${BASE}/markets/${v}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    ...UNIVERSE.map((s) => ({
      url: `${BASE}/stocks/${encodeURIComponent(s.symbol)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/news`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/track-record`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
