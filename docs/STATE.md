# TradeMyShow — project state

Living document. **Read at the start of every session; update at the end of every
session.** Last updated: 2026-08-21 (second session that day).

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
| Real market data is the default; the simulation is the opt-out | A default that shows invented prices unless somebody sets a variable is a default that shows invented prices. `MARKET_DATA_PROVIDER` unset means Yahoo → Stooq → Finnhub-if-keyed. `mock` forces the simulation. |
| No number is printed without its provenance | Yahoo's and Stooq's keyless endpoints are not a data licence, so quotes are labelled delayed or end-of-day, and anything the feed could not supply is labelled simulated rather than dressed up as a price. `sourceFor()` is the single decider. |
| Real and simulated figures are never mixed on one screen | A simulated volume beside a real price is the worst of both. Under a real feed only what the vendor supplied is filled in; a blank cell is honest. Under the simulation it fills everything, because the page is already labelled. |
| Stock pages are public; the paywall is the exact score | The product cannot be judged before signing up if a visitor cannot look at one stock. Signed-out visitors get exactly the free plan's view. |
| The free plan keeps 3 alerts, not 0 | An alert is what earns the second visit. A free tier that cannot set one never gets it. |
| Free tier proves the product; the exact score is the upgrade trigger | Free: 1 watchlist, 2-way compare, 15 rows on 52-week screens. Pro/Premium unlock the rest. |

## 3. Architecture quick map

```
src/lib/marketdata.ts        UNIVERSE (150 instruments); reads the cache first,
                             falls back to the seeded price engine
src/lib/providers/feed.ts    vendor chain, fallback, search, and sourceFor()
src/lib/providers/yahoo.ts   keyless quotes, history, intraday, search, news
src/lib/providers/stooq.ts   keyless end-of-day CSV, a different operator
src/lib/marketrefresh.ts     the refresh job + coverage reporting
src/components/SiteShell.tsx the one frame every page uses
src/components/GlobalSearch.tsx  header type-ahead over the whole market
src/components/stock/        the public stock page and its four actions
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
- **Real market data.** Yahoo Finance (keyless) with Stooq end-of-day underneath
  and Finnhub when a key exists, written into the SQLite cache by a refresh job
  that every page then reads synchronously. `npm run refresh`,
  `POST /api/cron?job=market-data`, or `POST /api/market/refresh`; the landing
  page fills an empty cache itself on first visit.
- **Provenance on every price.** delayed / end-of-day / simulated, with the
  vendor named, decided in one place and shown as a pill on the board, the
  stock page and the full chart.
- **Public type-ahead search** in the header of every page, covering the whole
  market rather than the shipped universe. Symbols the vendor confirms are
  remembered in `symbol_directory`, so the second lookup is local. "/" focuses.
- **One shell everywhere** — landing, market screens, stock pages, news, and the
  signed-in dashboard share `SiteShell` (sidebar + header + search). Logging in
  no longer changes the layout.
- **Public stock page** at `/stocks/[symbol]` (the old `/dashboard/stocks/...`
  permanently redirects), laid out like stockanalysis.com: price, actions,
  statistics with the price's position in its 52-week range, chart with nine
  ranges, score, news. Plus `/stocks/[symbol]/chart` for the chart alone.
- **Watchlist / Alerts / Compare** buttons with a sign-up gate for signed-out
  visitors and a list picker for signed-in ones. Alerts now watch a price as
  well as a score.
- **Market news and a newsletter sign-up** below the board, plus a `/news` page.
- 383 unit tests and 34 e2e specs passing.
- **Every page fits a phone.** The left rail becomes a scrolling strip below
  980px instead of vanishing (a phone previously had no navigation at all), the
  header action row wraps, and wide tables and charts scroll inside their own
  container rather than taking the page with them.
- Settings → "Your data" now exists. The nav had linked to it for weeks and the
  route was never committed, because `.gitignore` had an unanchored `data/`.

## 5. Next up

- [ ] **Verify the live feed against the real internet.** It was written and
      unit-tested in a sandbox whose egress policy blocks
      `query1.finance.yahoo.com` and `stooq.com`, so the adapters have never
      made a successful call. Run `npm run refresh:history` on a machine with
      open network and check `GET /api/market/refresh` reports coverage near
      100%. If Yahoo's response shape has drifted, `src/lib/providers/yahoo.ts`
      is the only file that needs touching.
- [ ] Fundamentals the keyless endpoints do not carry: P/E, EPS, revenue,
      dividend, shares outstanding, earnings date. Needs either a licensed feed
      or SEC company-facts, and until then those rows are absent rather than
      invented.
- [ ] Wire the newsletter to an actual send (the addresses are stored and
      unsubscribe works; nothing is mailed yet).
- [ ] Re-run the contrast audit over the new `.gsearch-*`, `.act-*`, `.stock-*`
      and `.news-*` components.
- [ ] Republish `docs/tracker.html`.
- [ ] Sector and market-cap filters on the screens, the way stockanalysis.com
      filters its gainers list.

## 6. Blocked on a purchase or a decision, not on code

- A *licensed* market data feed. The keyless endpoints now in use are the ones
  Yahoo's own site calls and Stooq's public CSV files: fine for showing a
  visitor a delayed price, not a redistribution licence, and not a contract
  anyone can complain to. Vendor still not chosen.
- A licensed news feed. Yahoo's search endpoint returns headlines and links but
  no article text, so summaries are blank rather than invented.
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
- `min-width: auto` on a flex or grid item is what turns a scroll container into
  a page-wide overflow: the item sizes to its widest child, so the scroll box
  has nothing left to scroll. `.card`, `.shell-main` and `.settings-content`
  carry `min-width: 0` for this reason, and wide content uses `.scroll-x`.
- `flex: none` on a row means it is never asked to be narrower than its
  contents, so `flex-wrap` inside it never fires. The header action row needs
  both `flex: 1 1 auto` and `min-width: 0` to wrap on a phone.
- A redirect for a path under `/dashboard` cannot live in a page there: the
  layout's auth check redirects to /login first. Use `redirects()` in
  `next.config.mjs`.
- The cloud sandbox blocks outbound HTTPS to finance hosts. Anything touching a
  real vendor has to be verified on a machine with open network.
- A running `next start` keeps port 3000 and the next one fails with
  `EADDRINUSE` — and the *old build* keeps serving, which looks exactly like a
  change that did not take. Kill `next-server`, not `next start`.
- Playwright in the cloud sandbox: launch with
  `executablePath: "/opt/pw-browsers/chromium"`; the bundled browser build does
  not match the installed one.
