# TradeMyShow — build history

**Do not read this file by default.** `docs/STATE.md` carries everything a
session needs to start work. This is the archive behind it: what was built and,
where it matters, why. Open it only when someone asks how something came to be,
or when a decision in STATE.md needs its reasoning recovered.

Newest last.

## Foundations

- Auth: email/password, email verification, password reset, TOTP, OTP over email
  and SMS, security questions, OAuth social login.
- Billing: tiers, pause/resume/upgrade, gating enforced server-side.
- Admin: user list by tier, per-user profile view, per-user change log.
- Settings: profile, security, billing, activity, data export/delete.
- Legal: terms/privacy pages, signup acceptance, PDF contract per user, $1,000
  liability cap, wording audit enforced in CI.
- Security: CSP with per-request nonce, HSTS, cookie consent, rate limiting.
- LLM router with automatic failover between Gemini, Anthropic and OpenAI.

## Market screens

- Five screens — top gainers, top losers, biggest moves, near 52-week highs,
  near 52-week lows — 50 rows each, plus 2-way and multi-way compare.
- Landing page rebuilt as a full-width dashboard with sidebar, index strip,
  market breadth and the live gainers table; hero later compressed to a band so
  the data sits above the fold.
- Prices anchored to realistic per-instrument levels, with volume and
  market-cap columns on every screen. A random walk from an arbitrary start
  produces prices that are individually plausible and collectively absurd — a
  sector ETF above the index it tracks — which anyone who follows markets spots
  immediately.

## Real market data

- Yahoo Finance (keyless) with Stooq end-of-day underneath and Finnhub when a
  key exists, written into the SQLite cache by a refresh job that every page
  then reads synchronously. `npm run refresh`, `POST /api/cron?job=market-data`,
  or `POST /api/market/refresh`; the landing page fills an empty cache itself on
  first visit.
- The default flipped from `mock` to live. A default that shows invented prices
  unless somebody sets a variable is a default that shows invented prices. The
  test suite pins itself to `mock` instead, so no unit test reaches a vendor.
- Provenance on every price — delayed / end-of-day / simulated, vendor named,
  decided in one place (`sourceFor()`) and shown as a pill on the board, the
  stock page and the full chart.
- Refresh work is bounded by a wall-clock budget that limits both the queue and
  the request in flight. A vendor that is unreachable rather than slow costs the
  full timeout per symbol, and 150 of those is a request that never returns.
- `.env.example` stopped shipping `MARKET_DATA_PROVIDER=mock`, which had been
  copied into every install and was the likeliest reason a correct deployment
  still showed invented prices.
- `npm run verify:prices` compares us against the vendor symbol by symbol and
  exits non-zero on disagreement; `/dashboard/admin` → Market data shows
  coverage plus per-symbol provenance with a "check against Yahoo" link.

## The rebuild around search and the stock page

- Public type-ahead search in the header of every page, covering the whole
  market rather than the shipped universe. Symbols the vendor confirms are
  remembered in `symbol_directory`, so the second lookup is local. "/" focuses.
- One shell everywhere — landing, market screens, stock pages, news and the
  signed-in dashboard share `SiteShell`. Logging in previously threw away the
  layout the visitor was already using.
- Public stock page at `/stocks/[symbol]` (the old `/dashboard/stocks/...`
  permanently redirects via `next.config.mjs`), laid out like
  stockanalysis.com: price, actions, statistics with the price's position in its
  52-week range, chart with nine ranges, score, news. Plus
  `/stocks/[symbol]/chart` for the chart alone.
- Watchlist / Alerts / Compare buttons with a sign-up gate for signed-out
  visitors and a list picker for signed-in ones. Alerts watch a price as well as
  a score.
- Market news and a newsletter sign-up below the board, plus a `/news` page.
- Orphaned by this rebuild and deleted: `StockDetail`, `StockSearch`,
  `MarketMovers`, `IndexStrip`.

## Traffic counting

- Visitor counters (unique/repeat), server-side so ad blockers do not distort
  them, identified by a hash re-salted daily.
- Admin-only counters in the page footer (total views, visitor-days, repeats,
  unique today, returned today, views per visit), gated server-side so they are
  absent from the HTML for everyone else. The fuller panel stays on
  `/dashboard/admin`.

## Fixes worth remembering

- Every page fits a phone. The left rail becomes a scrolling strip below 980px
  instead of vanishing — a phone previously had no navigation at all.
- Settings → "Your data" had been a 404 for weeks: `.gitignore` carried an
  unanchored `data/`, which matches a directory of that name at any depth, so
  the route was never committed. The rule is now `/data/`.
- The sign-up prompt was inviting signed-in subscribers to create a free
  account. It excluded them by path, which stopped working when stock pages
  left `/dashboard`.
- Update scripts took a hardcoded old branch and used `git pull`, which only
  moves the branch you are standing on — an update could report success and
  change nothing. They now fetch and check out explicitly, resolve the project
  root from their own location, compare captured SHAs instead of `HEAD@{1}`,
  and run `npm run refresh`.

## PR #11 (branched off #9, which stays frozen)

- Signed-out landing popup (`FeatureSpotlight.tsx`): one random entry from a
  `FEATURES` array per landing-page load, reusing the site's `.pop`/
  `.pop-backdrop` modal with a `pop-vivid` gradient variant. Waits 1.5s and
  fades/scales in rather than snapping into view (`pop-fade`/`pop-in`,
  shared by `SignupGate`). Replaced an earlier inline announcement-bar
  attempt and a rival, uncoordinated Claude session's permanent "what's new"
  carousel (PR #10, closed — its approach re-introduced the ever-growing
  landing section the popup exists to avoid).
- Concentrated colour vibrancy on the primary CTA (`.btn` gradient+glow) and
  the popup only — a deliberate choice over a full broker-style repaint, so
  the rest of the site keeps its calm, contrast-checked base.
- Sticky news rails: stock page (`.stock-lower-side`) and landing
  (`.board-side`/`.board-layout`, market table + `MarketNewsFeed` side by
  side, collapses under 1180px). Chosen over height-matching because the
  paired content is a different length on every page — sticky just tracks
  the scroll instead of leaving blank space under a short list.
  `recentNewsAcross` was later found to have no per-symbol cap, so a
  heavily-viewed ticker could fill the "market-wide" widget with itself;
  fixed to cap rows per symbol.
- Overnight (pre/post-market) price on the stock page: real Yahoo
  `includePrePost` data only, cached in `quote_stats_cache`, shown as an
  equal `.stock-price-row` block beside the regular close (not a footnote
  line) — only appears in an actual extended-hours window; needs live
  verification since the sandbox blocks finance hosts.
- "Delayed quote" pill shrunk to a quiet `.src-info` ⓘ icon for real/delayed
  data (tooltip carries the full text) — it was reading as a warning for
  something routine. Simulated data keeps its visible pill; that disclosure
  actually matters.
- Footer social icons (`SocialLinks.tsx`): Facebook/X/LinkedIn/YouTube as
  filled brand-colour circular badges. **Placeholder handles** — swap for
  the real accounts before launch.
- Pricing: annual discount raised to ~20% (was 17%); `/pricing` and the
  landing page's own "Straightforward pricing" cards (`app/page.tsx` —
  a separate, previously non-interactive section) both carry
  `?plan=free|pro|premium` to `/register`, which shows an honest note (no
  separate signup path per plan — everyone gets the same trial).
  `AuthForm` shows Log in/Sign up as equal-weight buttons; un-bolded the
  "not investment advice" consent text.
- Trial-ending discount email: `jobs.ts#runTrialNudgeJob` mails once when a
  trial has ≤3 days left (guarded by a one-time `trial_nudge_sent_at`
  column, not the days-left window), offering promo code `TRIALSAVE20` via
  the existing checkout promo system. `BillingSection.tsx` gained an actual
  promo-code input, which hadn't existed before. `scripts/create-promo.ts`
  / `job=promo` on `/api/cron` mint arbitrary codes without a DB client.
  **Nothing sends until a real mail provider is configured** — §7.
