"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PortfolioDonut from "./PortfolioDonut";
import { allocationSlices } from "@/lib/portfolio";

/**
 * "What's new" for a signed-out visitor — a slow-advancing tour of the four
 * things added most recently, each illustrated rather than described in
 * prose alone. Deliberately not a marquee: the news ticker moves because
 * headlines are disposable and skimmed; this holds each panel long enough
 * to actually read, because the point is to be understood, not just noticed.
 */

const ILLUSTRATION_SLICES = allocationSlices([
  { label: "Core holdings", value: 68318 },
  { label: "AI & Chips", value: 30979 },
  { label: "Income & ballast", value: 25660 },
]);

const SLIDES = [
  {
    id: "portfolio",
    eyebrow: "New — Portfolio",
    title: "See what you actually hold",
    body: "Add share counts to any watchlist and it becomes a priced portfolio — one number for everything, one donut for how it splits, and one more for each list on its own.",
    href: "/dashboard/portfolio",
    cta: "See a sample portfolio",
  },
  {
    id: "fundamentals",
    eyebrow: "New — Fundamentals",
    title: "P/E, EPS, dividends — not just a price",
    body: "The numbers a free stock screener already shows you, on the same page as a score that explains its own reasoning line by line.",
    href: "/stocks/AAPL",
    cta: "Open a stock page",
  },
  {
    id: "peers",
    eyebrow: "New — Sector peers",
    title: "Never dead-end on one stock",
    body: "Every stock page now lists the other companies actually competing with it, with a live price each and one click into a side-by-side Compare.",
    href: "/stocks/AAPL",
    cta: "See peers in action",
  },
  {
    id: "alerts",
    eyebrow: "New — Alerts",
    title: "Three ways to be told, not just one",
    body: "A price crossing a line you set, a daily move past a threshold, or the Insight Score itself turning — pick the one that matches how you actually watch a stock.",
    href: "/register",
    cta: "Set your first alert",
  },
] as const;

function Illustration({ id }: { id: (typeof SLIDES)[number]["id"] }) {
  if (id === "portfolio") {
    return (
      <div className="fs-illus fs-illus-portfolio">
        <PortfolioDonut
          slices={ILLUSTRATION_SLICES}
          centerLabel="total"
          centerValue="$124,957"
        />
        <ul className="fs-mini-legend">
          {ILLUSTRATION_SLICES.map((s) => (
            <li key={s.label}>
              <span className="fs-swatch" style={{ background: s.color }} />
              {s.label}
              <span className="dim">{s.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (id === "fundamentals") {
    return (
      <div className="fs-illus fs-illus-stats">
        <dl className="fs-stat-list">
          <div><dt>P/E (trailing)</dt><dd className="mono">32.1</dd></div>
          <div><dt>EPS</dt><dd className="mono">$6.50</dd></div>
          <div><dt>Dividend yield</dt><dd className="mono">0.48%</dd></div>
          <div><dt>Next earnings</dt><dd>Jan 28, 2026</dd></div>
        </dl>
      </div>
    );
  }
  if (id === "peers") {
    return (
      <div className="fs-illus fs-illus-peers">
        {[
          { sym: "MSFT", chg: "+0.67%", up: true },
          { sym: "GOOGL", chg: "+0.67%", up: true },
          { sym: "META", chg: "-0.96%", up: false },
        ].map((p) => (
          <div className="fs-peer-row" key={p.sym}>
            <strong>{p.sym}</strong>
            <span className={p.up ? "gain" : "loss"}>{p.chg}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="fs-illus fs-illus-alert">
      <div className="fs-alert-card">
        <span aria-hidden="true">🔔</span>
        <div>
          <strong>AAPL is down more than 5% today</strong>
          <p className="dim">Day&apos;s move ≤ −5% · triggers once</p>
        </div>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (paused || reduceMotion.current) return;
    const t = setInterval(() => setActive((a) => (a + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[active];

  return (
    <section className="section">
      <h2>What&apos;s new</h2>
      <div
        className="fs-shell"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <button
          type="button"
          className="fs-nav prev"
          aria-label="Previous feature"
          onClick={() => setActive((a) => (a - 1 + SLIDES.length) % SLIDES.length)}
        >
          ‹
        </button>

        <div className="fs-panel" key={slide.id}>
          <div className="fs-copy">
            <span className="fs-eyebrow">{slide.eyebrow}</span>
            <h3>{slide.title}</h3>
            <p className="dim">{slide.body}</p>
            <Link href={slide.href} className="btn small">
              {slide.cta} →
            </Link>
          </div>
          <div className="fs-visual">
            <Illustration id={slide.id} />
          </div>
        </div>

        <button
          type="button"
          className="fs-nav next"
          aria-label="Next feature"
          onClick={() => setActive((a) => (a + 1) % SLIDES.length)}
        >
          ›
        </button>
      </div>

      <div className="fs-dots" role="tablist" aria-label="Feature slides">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={s.eyebrow}
            className={i === active ? "on" : ""}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </section>
  );
}
