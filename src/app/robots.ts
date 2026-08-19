import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL ?? "https://trademyshow.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private, per-user pages carry no SEO value and should not be crawled.
        disallow: ["/dashboard", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
