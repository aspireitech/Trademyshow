"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";

interface SubState {
  state: { plan: string; paused: boolean; pausedUntil: string | null; daysRemaining: number };
  trialing: boolean;
  effectivePlan: string;
  trialDaysRemaining: number;
  canPause: boolean;
  nextPlan: string | null;
  pricing: Record<string, { monthlyUsd: number; annualUsd: number; annualSavingPct: number }>;
  maxPauseDays: number;
}

interface ReferralData {
  code: string | null; pending: number; converted: number;
  earnedCents: number; commissionPct: number; shareUrl: string | null;
}

export default function BillingSection() {
  const [sub, setSub] = useState<SubState | null>(null);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [pauseDays, setPauseDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([
      apiFetch("/api/billing/subscription").then((x) => (x.ok ? x.json() : null)),
      apiFetch("/api/referrals").then((x) => (x.ok ? x.json() : null)),
    ]);
    setSub(s as SubState | null);
    setReferrals(r as ReferralData | null);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function act(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/billing/subscription", body);
    setBusy(false);
    if (!ok) { setError(data.error ?? "That did not work."); return; }
    await refresh();
  }

  async function upgrade(plan: string) {
    setBusy(true); setError(null);
    const { ok, data } = await apiPost<{ url?: string; error?: string }>("/api/billing/checkout", {
      plan, interval: "monthly",
    });
    setBusy(false);
    if (!ok) { setError(data.error ?? "Could not start checkout."); return; }
    if (data.url) window.location.href = data.url;
    else await refresh();
  }

  if (!sub) return <section className="card"><h3>Plan &amp; billing</h3><p className="dim">Loading…</p></section>;

  const { state, nextPlan, pricing, maxPauseDays, trialing, trialDaysRemaining, canPause } = sub;
  const price = pricing[trialing ? "pro" : state.plan];

  return (
    <>
      <section className="card">
        <div className="sec-head">
          <h3>Your plan</h3>
          <span className={`badge ${sub.effectivePlan !== "free" ? "pro" : ""}`}>
            {trialing ? "Pro trial" : state.plan}
          </span>
        </div>

        {state.paused ? (
          <div className="callout" style={{ marginTop: 12 }}>
            <strong>Paused.</strong>{" "}
            <span className="dim">
              Billing and emails are stopped. Everything else — watchlists, history, your record —
              is untouched and waiting. Resumes in {state.daysRemaining} day
              {state.daysRemaining === 1 ? "" : "s"}.
            </span>
            <div style={{ marginTop: 10 }}>
              <button className="btn small" onClick={() => act({ action: "resume" })} disabled={busy}>
                Resume now
              </button>
            </div>
          </div>
        ) : trialing ? (
          <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>
            Every Pro feature is unlocked for another{" "}
            <strong>{trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"}</strong>. No card
            is held, and nothing is charged when it ends — the account simply returns to the free
            plan unless you subscribe.
          </p>
        ) : (
          <p className="dim" style={{ fontSize: 14, marginTop: 8 }}>
            {price
              ? `$${price.monthlyUsd} a month, or $${price.annualUsd} a year — ${price.annualSavingPct}% less.`
              : "The free plan: one watchlist, five holdings, score bands rather than exact scores."}
          </p>
        )}

        <div className="plan-actions">
          {nextPlan && !state.paused && (
            <button className="btn small" onClick={() => upgrade(nextPlan)} disabled={busy}>
              Upgrade to {nextPlan} — ${pricing[nextPlan]?.monthlyUsd}/mo
            </button>
          )}
          {canPause && !state.paused && (
            <button className="btn small secondary" onClick={() => act({ action: "change", plan: "free" })} disabled={busy}>
              Downgrade to free
            </button>
          )}
          <Link className="btn small secondary" href="/pricing">Compare plans</Link>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {!state.paused && canPause && (
        <section className="card">
          <h3>Take a break instead of cancelling</h3>
          <p className="dim" style={{ fontSize: 14 }}>
            Stops billing and emails for a while, and keeps everything else exactly as it is. Come
            back whenever — nothing is deleted.
          </p>
          <div className="inline-form" style={{ marginTop: 12 }}>
            <label htmlFor="pause-days" className="dim" style={{ fontSize: 13 }}>Pause for</label>
            <select id="pause-days" className="input" style={{ maxWidth: 130 }}
              value={pauseDays} onChange={(e) => setPauseDays(Number(e.target.value))}>
              {[7, 14, 30, 60, maxPauseDays].filter((d, i, a) => a.indexOf(d) === i).map((d) => (
                <option key={d} value={d}>{d} days</option>
              ))}
            </select>
            <button className="btn small secondary" onClick={() => act({ action: "pause", days: pauseDays })} disabled={busy}>
              Pause subscription
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h3>Refer a friend</h3>
        {referrals ? (
          <>
            <p className="dim" style={{ fontSize: 14 }}>
              Share your link. When someone you refer subscribes, you earn{" "}
              <strong>{referrals.commissionPct}%</strong> of what they pay, for as long as they stay.
            </p>
            {referrals.shareUrl && (
              <div className="inline-form" style={{ marginTop: 12 }}>
                <input className="input mono" readOnly value={referrals.shareUrl}
                  style={{ flex: "1 1 240px", fontSize: 13 }} aria-label="Your referral link" />
                <button className="btn small" onClick={() => {
                  void navigator.clipboard?.writeText(referrals.shareUrl!).then(() => setCopied(true));
                }}>
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            )}
            <div className="grid cols-3" style={{ marginTop: 16 }}>
              <div className="stat"><strong>{referrals.pending}</strong><span className="dim">signed up</span></div>
              <div className="stat good"><strong>{referrals.converted}</strong><span className="dim">subscribed</span></div>
              <div className="stat good"><strong>${(referrals.earnedCents / 100).toFixed(2)}</strong><span className="dim">earned</span></div>
            </div>
          </>
        ) : <p className="dim">Loading…</p>}
      </section>
    </>
  );
}
