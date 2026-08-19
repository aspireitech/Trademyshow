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
    <div className="cookie-notice" role="region" aria-label="Analytics consent">
      <p>
        We use a cookie to keep you signed in. May we also count anonymous page views to see which
        insights people actually read? <Link href="/privacy">Privacy</Link>
      </p>
      <div className="cookie-actions">
        <button className="btn small secondary" onClick={() => decide("denied")}>
          No thanks
        </button>
        <button className="btn small" onClick={() => decide("granted")}>
          Allow
        </button>
      </div>
    </div>
  );
}
