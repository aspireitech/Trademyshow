"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Bump the id whenever the copy below changes so the bar reappears for
 * visitors who dismissed an older announcement — dismissal is per-id, not
 * global, so this is the only edit needed to run a new one.
 */
const ANNOUNCEMENT_ID = "track-record-2026-08";
const STORAGE_PREFIX = "announcement-dismissed:";

/**
 * A single rotating slot instead of a permanent "what's new" section, so the
 * landing page length stays fixed no matter how many features ship — update
 * the id/copy here rather than appending another block to the page.
 */
export default function AnnouncementBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_PREFIX + ANNOUNCEMENT_ID) !== "1") setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_PREFIX + ANNOUNCEMENT_ID, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="announce-bar" role="region" aria-label="Announcement">
      <span className="live-dot" aria-hidden="true" />
      <p>
        New: every past call is graded against what actually happened —{" "}
        <Link href="/track-record">see the live track record</Link>
      </p>
      <button
        className="announce-close"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
