"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SEEN_KEY = "tms_prompt_dismissed";
const PAGES_KEY = "tms_pages_seen";
const PAGES_BEFORE_PROMPT = 3;

/**
 * A soft prompt to create a free account, after the third page.
 *
 * Deliberately soft: nothing is hidden, nothing is blocked, and dismissing it
 * is remembered. A registration wall in front of the content would stop the
 * one thing that sells this product — letting someone see an explained move
 * and judge whether the analysis is any good.
 *
 * It appears on the third page because by then the visitor has chosen to look
 * around, which is the difference between an offer and an interruption.
 */
export default function SignupPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Never on the pages where it would be absurd or in the way.
    if (/^\/(login|register|reset-password|verify-email|unsubscribe|dashboard)/.test(pathname)) return;

    try {
      if (localStorage.getItem(SEEN_KEY)) return;

      const seen: string[] = JSON.parse(localStorage.getItem(PAGES_KEY) ?? "[]");
      // Distinct pages, not page views: refreshing the same article is not
      // exploring, and counting it would nag people who are still reading one thing.
      const next = seen.includes(pathname) ? seen : [...seen, pathname];
      localStorage.setItem(PAGES_KEY, JSON.stringify(next.slice(-10)));

      if (next.length >= PAGES_BEFORE_PROMPT) {
        const t = setTimeout(() => setShow(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      // Storage unavailable — stay quiet rather than prompting every page.
    }
  }, [pathname]);

  // Counted server-side too, because ad blockers remove client analytics for a
  // large share of exactly this audience.
  useEffect(() => {
    void fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="signup-prompt" role="dialog" aria-label="Create a free account">
      <button className="signup-close" onClick={dismiss} aria-label="Dismiss">✕</button>
      <p className="signup-lede">
        <strong>Enjoying the analysis? Keep it.</strong>
      </p>
      <p className="dim">
        A free account saves a watchlist and sends you the daily insight for it. No card, and the
        free plan stays free — you only pay if you later want the exact scores and more lists.
      </p>
      <div className="signup-actions">
        <Link href="/register" className="btn small">Create a free account</Link>
        <button className="btn small secondary" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
