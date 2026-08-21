"use client";

import Link from "next/link";

/**
 * The moment we ask for an account.
 *
 * Placed where the visitor has just decided they want something — to keep a
 * stock, to be told when it moves — rather than at the door. That ordering is
 * the whole conversion argument: the value has already been demonstrated, so
 * the ask reads as "keep this" instead of "pay to look".
 */
export default function SignupGate({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <div className="pop-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pop"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p className="dim">{body}</p>
        <ul className="features" style={{ margin: "12px 0" }}>
          <li>Free forever — no card to start</li>
          <li>A watchlist, alerts and a daily read on what moved</li>
          <li>Every score itemised, every past call published</li>
        </ul>
        <div className="pop-actions">
          <Link href="/register" className="btn">Create a free account</Link>
          <Link href="/login" className="btn secondary">Log in</Link>
        </div>
        <button type="button" className="pop-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
