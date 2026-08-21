# TradeMyShow — project state

Living document. **Read at the start of every session; update at the end of every
session.** Last updated: 2026-08-21.

---

## 1. What this is

A stock-insight SaaS. The differentiator is that every score is broken into parts
the user can check, and every published score is graded afterwards against what
actually happened (`/track-record`). Competitors can copy a number overnight; they
cannot copy a history.

## 2. Settled decisions — do not re-open these

| Decision | Why |
|---|---|
| The AI narrates arithmetic it cannot alter | Keeps the product inside the publisher exclusion, Investment Advisers Act §202(a)(11)(D), *Lowe v. SEC*. If the model could change the number, it would be advice. |
| No forecasting language anywhere | §215(a) anti-waiver means disclaimers cannot cure a statutory breach. Copy describes what *happened*, never what *will* happen. A wording audit enforces this in tests. |
| Liability cap of $1,000, accepted at signup, contract stored as PDF | User requirement. `src/lib/legal.ts` is the single source for both the page and the PDF; `src/lib/contracts.ts` stores a SHA-256 alongside the file so the record is tamper-evident. |
| Light theme is the true default | User requirement. The `prefers-color-scheme: dark` block was removed; dark is opt-in only. |
| No permanent "70% OFF" banner | A permanent discount is a false anchor and is actionable under UK/EU/US pricing rules. |
| Market data is simulated, and says so | No paid feed is bought yet. Prices are a seeded random walk pinned to realistic anchor levels. |
| Free tier proves the product; the exact score is the upgrade trigger | Free: 1 watchlist, 2-way compare, 15 rows on 52-week screens. Pro/Premium unlock the rest. |

## 3. Architecture quick map

```
src/lib/marketdata.ts        UNIVERSE (150 instruments) + seeded price engine
src/lib/insight/score.ts     the score and its bands
src/lib/insight/movers.ts    five market screens, memoised per day
src/lib/insight/trackrecord.ts  back-graded published scores, memoised per day
src/lib/legal.ts             terms as data (page + PDF share one source)
src/lib/pdf.ts               hand-rolled PDF writer, no dependency
src/lib/contracts.ts         signed-contract records
src/middleware.ts            CSP with per-request nonce; HSTS keyed off x-forwarded-proto
src/components/SiteSidebar.tsx      left nav incl. the user's watchlists
src/components/MarketsDashboard.tsx index strip + breadth + 50-row screen table
```

**Performance rule:** anything that scans the whole universe must be memoised per
day. `movers.ts` and `trackrecord.ts` both do this. Forgetting it is what made the
test suite time out when the universe grew from 61 to 150 symbols.

## 4. Done

- Auth: email/password, email verification, password reset, TOTP, OTP over email
  and SMS, security questions, OAuth social login.
- Billing: tiers, pause/resume/upgrade, gating enforced server-side.
- Admin: user list by tier, per-user profile view, per-user change log.
- Settings: profile, security, billing, activity, data export/delete.
- Legal: terms/privacy pages, signup acceptance, PDF contract per user, $1,000 cap,
  wording audit in CI.
- Security: CSP with nonce, HSTS, cookie consent, rate limiting.
- Market screens: top gainers, top losers, biggest moves, near 52-week highs, near
  52-week lows — 50 rows each, plus 2-way/multi-way compare.
- Landing page rebuilt as a full-width dashboard with sidebar, index strip, market
  breadth, and the live gainers table.
- LLM router with automatic failover between Gemini, Anthropic and OpenAI.
- Visitor counters (unique/repeat) in the footer; signup prompt after 2–3 pages.
- 338 unit tests passing; 30 e2e specs.
- Prices anchored to realistic per-instrument levels, with volume and market-cap
  columns on every screen.
- Landing hero compressed to a band so the market data sits above the fold.

## 5. Next up

- [ ] Re-run the contrast audit over the new `.mkt-*` components and the hero
      proof cards.
- [ ] Republish `docs/tracker.html`.
- [ ] Run the Playwright e2e suite against the rebuilt landing page (the specs
      that assert on the old hero markup may need updating).
- [ ] Sector and market-cap filters on the screens, the way stockanalysis.com
      filters its gainers list.

## 6. Blocked on a purchase or a decision, not on code

- Market data feed (real quotes) — vendor not chosen.
- News feed — vendor not chosen.
- Penetration test.
- Lawyer review of the terms.
- Production API keys for Gemini / Anthropic / OpenAI.
- GitHub's default branch still needs flipping to `main` in repo settings so PRs
  can be opened against it.

## 7. Known traps

- `better-sqlite3` has no Node 24 prebuild. Use Node 22.
- PowerShell `Out-File -Encoding utf8` writes a BOM that silently breaks
  `.env.local`. Use `-Encoding ascii`.
- Stop the running server before `npm ci` on Windows, or the native module fails
  to unlink with `EPERM`.
- Contrast: coloured text on a tint of its own hue caps around 4.1:1. Measure
  against the composited result, not the token.
- Playwright in the cloud sandbox: launch with
  `executablePath: "/opt/pw-browsers/chromium"`; the bundled browser build does
  not match the installed one.
