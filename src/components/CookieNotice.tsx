"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANALYTICS_CONSENT_KEY } from "@/lib/apiClient";

/**
 * Consent for the one non-essential thing we do: product analytics.
 *
 * The session and CSRF cookies are strictly necessary and need no consent, so
 * this banner does not pretend to gate them. It gates analytics, and it
 * actually does — `track()` checks the same key before sending anything, so
 * declining is a real decision rather than a dismissed dialog.
 */
export default function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ANALYTICS_CONSENT_KEY)) setShow(true);
    } catch {
      // Storage blocked — treat as declined and stay quiet.
    }
  }, []);

  function decide(value: "granted" | "denied") {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="cookie-notice" role="region" aria-label="Cookies and analytics">
      <p>
        <strong>Cookies and what we count.</strong> A cookie keeps you signed in — that one is
        required and cannot be switched off. Separately, we would like to count page views.
      </p>

      {/* Named specifically. "We use cookies to improve your experience" tells
          a reader nothing and is precisely the wording regulators treat as an
          absence of informed consent. */}
      <ul className="cookie-list">
        <li>
          <strong>If you allow it:</strong> which pages are opened, and a visitor identifier that
          is a one-way hash of your IP address and browser, re-salted every day — so returns
          within a day can be counted, and nothing can be linked to you across days or to your
          account.
        </li>
        <li>
          <strong>Never:</strong> no advertising cookies, no third-party trackers, no selling or
          sharing of anything with anyone.
        </li>
        <li>
          <strong>Either way:</strong> the site works identically. Declining costs you nothing.
        </li>
      </ul>

      <p className="dim cookie-fine">
        TradeMyShow publishes analytics and education only — never investment advice, and never a
        recommendation to buy or sell. Nothing here is a promise about any price. Our liability is
        limited as set out in the <Link href="/terms">Terms</Link>; see also{" "}
        <Link href="/privacy">Privacy</Link>.
      </p>

      <div className="cookie-actions">
        <button className="btn small secondary" onClick={() => decide("denied")}>
          No thanks
        </button>
        <button className="btn small" onClick={() => decide("granted")}>
          Allow counting
        </button>
      </div>
    </div>
  );
}
