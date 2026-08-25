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
 * One entry, one popup — the alternative to permanently stacking a "what's
 * new" section on the landing page. Add an entry here when something ships;
 * nothing else on the page grows.
 */
const FEATURES: Feature[] = [
  {
    id: "real-data",
    title: "Real prices, clearly labelled",
    body: "Every quote is sourced from a named vendor, never guessed. Where no real quote reached us, the figure says simulated instead of pretending to be a price.",
    href: "/help",
    cta: "How we source data",
  },
  {
    id: "track-record",
    title: "Every call, graded",
    body: "We publish every past score next to what actually happened, win or lose. No cherry-picking — see the full history.",
    href: "/track-record",
    cta: "See the track record",
  },
  {
    id: "fundamentals",
    title: "Fundamentals on every stock page",
    body: "P/E, EPS, dividend yield and the next earnings date, alongside the score and the chart — for any ticker, not just the names we ship.",
    href: "/stocks/AAPL",
    cta: "See it on a real stock",
  },
  {
    id: "portfolios",
    title: "Track more than one portfolio",
    body: "Editable share counts and an allocation view across as many portfolios as you keep — free accounts included.",
    href: "/dashboard/portfolio",
    cta: "Open portfolios",
  },
  {
    id: "alerts",
    title: "Alerts on a price or a score",
    body: "Set the line — a price level or a signal reading — and we tell you when it's crossed. No need to watch the chart yourself.",
    href: "/dashboard",
    cta: "Set an alert",
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
 * random feature per page load, closed with the X to reveal the market board
 * underneath. Nothing is remembered between visits: the whole point is that
 * it can rotate through anything shipped without the landing page growing.
 * Reuses the site's existing .pop/.pop-backdrop modal (see SignupGate) with
 * a `pop-vivid` modifier — the one deliberately loud surface on an otherwise
 * calm, AA-checked site.
 */
export default function FeatureSpotlight({ signedIn }: { signedIn: boolean }) {
  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (signedIn) return;
    // A pop-up that appears before the page has even settled reads as an
    // ad, not a feature. Landing on the market table first, then having
    // this arrive a beat later, is the difference between an interruption
    // and a follow-up.
    const timer = setTimeout(() => {
      setFeature(FEATURES[Math.floor(Math.random() * FEATURES.length)]);
    }, 1500);
    return () => clearTimeout(timer);
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
    <div className="pop-backdrop" role="presentation" onClick={() => setFeature(null)}>
      <div
        className="pop pop-vivid"
        role="dialog"
        aria-modal="true"
        aria-label={feature.title}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="live-dot" aria-hidden="true" />
        <h3>{feature.title}</h3>
        <p>{feature.body}</p>
        <div className="pop-actions">
          <Link href={feature.href} className="btn" onClick={() => setFeature(null)}>
            {feature.cta}
          </Link>
          <button type="button" className="pop-dismiss" onClick={() => setFeature(null)}>
            Not now
          </button>
        </div>
        <button
          type="button"
          className="pop-close"
          onClick={() => setFeature(null)}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
