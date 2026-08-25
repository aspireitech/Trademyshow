"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TRIAL_DAYS } from "@/lib/plans";

type Feature = {
  id: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

/**
 * One entry, one popup — this is the alternative to permanently stacking a
 * "what's new" section per shipped feature. Add an entry here when something
 * ships; nothing else in the landing page grows.
 */
const FEATURES: Feature[] = [
  {
    id: "track-record",
    title: "Every call, graded",
    body: "We publish every past score next to what actually happened, win or lose. No cherry-picking — see the full history.",
    href: "/track-record",
    cta: "See the track record",
  },
  {
    id: "score-breakdown",
    title: "See the working, not just the score",
    body: "Every score breaks into the parts that built it, so you can check it yourself instead of taking our word for it.",
    href: "/help",
    cta: "How the score works",
  },
  {
    id: "market-screens",
    title: "Five live market screens",
    body: "Gainers, losers, biggest moves, and stocks near their 52-week highs and lows — refreshed every market day.",
    href: "/markets/gainers",
    cta: "Browse the screens",
  },
  {
    id: "compare",
    title: "Compare stocks side by side",
    body: "Line two stocks up for free, or go multi-way on Pro to see which one actually holds up.",
    href: "/dashboard/compare",
    cta: "Try compare",
  },
  {
    id: "free-plan",
    title: "Start free, stay free",
    body: `Full access for ${TRIAL_DAYS} days, no card required, then a free plan forever.`,
    href: "/register",
    cta: "Start the free trial",
  },
];

/**
 * A popup, not a permanent section — shown only to signed-out visitors, one
 * random feature per page load, closed with the X to reveal the market table
 * underneath. Nothing is remembered between visits: the whole point is that
 * it can rotate through anything shipped without the landing page growing.
 */
export default function FeatureSpotlight({ signedIn }: { signedIn: boolean }) {
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (signedIn) return;
    setFeature(FEATURES[Math.floor(Math.random() * FEATURES.length)]);
  }, [signedIn]);

  useEffect(() => {
    if (!feature) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFeature(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [feature]);

  if (!feature) return null;

  return (
    <div
      className="spotlight-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={feature.title}
      onClick={() => setFeature(null)}
    >
      <div className="spotlight-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="spotlight-close"
          onClick={() => setFeature(null)}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
        <span className="live-dot" aria-hidden="true" />
        <h2>{feature.title}</h2>
        <p>{feature.body}</p>
        <div className="spotlight-actions">
          <Link href={feature.href} className="btn" onClick={() => setFeature(null)}>
            {feature.cta}
          </Link>
          <button className="spotlight-dismiss" onClick={() => setFeature(null)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
