# TradeMyShow — session state

**Read this file first, and usually only this file.** It exists so a cold
session costs almost nothing: the map below says which file owns what, so work
starts by opening two or three known files instead of searching the codebase.

Status: branch `claude/landing-dashboard-stock-data-5fngt1` · Node 22 ·
428 unit tests, 38 e2e specs, `next build` clean · updated 2026-08-23.

`tests/docs-map.test.ts` asserts every path in the map below exists and that
this file stays short enough to be worth reading every time. If you rename a
file, the map is part of the rename.

## 1. What this is

Stock-insight SaaS. Next.js 15 App Router, TypeScript strict, React 19, SQLite
via better-sqlite3. The differentiator: every score breaks into parts the user
can check, and every published score is graded afterwards against what actually
happened (`/track-record`). A competitor can copy a number overnight; they
cannot copy a history.

## 2. Commands

```
npm run dev              local dev
npx vitest run           unit suite — must be clean before pushing
npx next build           production build — must be clean before pushing
npx playwright test      e2e (needs a built app; PLAYWRIGHT_CHROMIUM_PATH in sandbox)
npm run seed             seed SQLite (demo@ + admin@, passwords in src/lib/sandbox.ts)
npm run refresh          fill the price cache from the live feed
npm run verify:prices    are the prices real? prints vendor vs. what we show
.\scripts\update.ps1     Windows deploy;  sudo ./scripts/update.sh  Linux/Azure
```

## 3. Settled — do not re-open

| Decision | Why |
|---|---|
| The AI narrates arithmetic it cannot alter | Publisher exclusion, Advisers Act §202(a)(11)(D), *Lowe v. SEC*. If the model could change the number it would be advice. |
| No forecasting language anywhere | §215(a) anti-waiver: disclaimers cannot cure a statutory breach. A wording audit enforces this in tests. |
| Real data is the default; `mock` is the opt-out | A default that shows invented prices unless someone sets a variable is a default that shows invented prices. |
| No number is printed without its provenance | The keyless endpoints are not a data licence. `sourceFor()` is the single decider; anything unsourced is labelled simulated. |
| Real and simulated figures never mix on one screen | A simulated volume beside a real price is the worst of both. Blank is honest. |
| Stock pages are public; the paywall is the exact score | The product cannot be judged before signup if you cannot look at one stock. |
| Traffic counters say "visitor-days", not "unique visitors" | The identifying hash re-salts daily, so one person over three days is three visitor-days. |
| Free tier proves the product | 1 watchlist, 5 stocks, 3 alerts, 2-way compare, 15 rows on 52-week screens. |
| Liability cap $1,000, accepted at signup, stored as PDF | Owner requirement. `src/lib/legal.ts` is the single source for page and PDF. |
| Light theme is the true default | Dark is opt-in via `:root[data-theme="dark"]` only. |

## 4. Map — which file owns what

**Market data** (all reads go through the cache, never straight to a vendor)
```
lib/marketdata.ts       UNIVERSE (150 symbols), getQuote/getHistory/week52Range.
                        Cache first, seeded random walk as the labelled floor.
lib/providers/feed.ts   vendor chain, fallback, search, refresh budget, sourceFor()
lib/providers/yahoo.ts  keyless quotes, history, intraday, search, news
lib/providers/stooq.ts  keyless end-of-day CSV — a second operator, on purpose
lib/providers/cache.ts  the synchronous read layer + symbol_directory
lib/marketrefresh.ts    the refresh job, coverage, on-demand per-symbol fetch
lib/news.ts             cached headlines, generated fallback
lib/insight/movers.ts   the five screens, memoised per day
```

**Scoring**
```
lib/insight/score.ts        the 0-100 score and its four components
lib/insight/expectation.ts  base rates by band — never a forecast
lib/insight/trackrecord.ts  back-graded published scores, memoised per day
lib/digest/engine.ts        per-holding facts;  digest/writer.ts  the prose
```

**Pages and shell**
```
components/SiteShell.tsx     the one frame: sidebar + header + footer
components/SiteHeader.tsx    brand, GlobalSearch, auth actions
components/GlobalSearch.tsx  header type-ahead ("/" focuses)
components/MarketsDashboard.tsx  index strip + breadth + 50-row table
components/stock/StockView.tsx   the public stock page (the big one)
components/stock/{WatchlistButton,AlertButton,SignupGate,FullChart}.tsx
components/AdminFooterStats.tsx  admin-only footer counters (server-gated)
app/page.tsx  the board  ·  app/stocks/[symbol]/  ·  app/markets/[view]/
app/globals.css  ~2000 lines, appended in themed sections
```

**Platform**
```
lib/db.ts        schema + migrations, all CREATE TABLE IF NOT EXISTS
lib/auth.ts      sessions, currentUser(), assertCsrf()
lib/plans.ts     PLAN_LIMITS — the single source for every gate
lib/jobs.ts      digest send, alert evaluation, market refresh
lib/security.ts  rate limits, clientIp, audit
lib/visitors.ts  traffic counting
middleware.ts    CSP nonce, HSTS
next.config.mjs  legacy redirects live here, not in pages
```

## 5. To change X, open Y

| Task | Files |
|---|---|
| A price or chart is wrong | `lib/marketdata.ts`, then `lib/providers/feed.ts` |
| A vendor changed its response | `lib/providers/yahoo.ts` — nothing else knows the shape |
| Add a market screen | `lib/insight/movers.ts` (`MoverView`) + `components/MarketsDashboard.tsx` |
| Change what a plan allows | `lib/plans.ts` only — every gate reads it |
| Add a table or column | `components/MarketsDashboard.tsx`; wrap wide content in `.scroll-x` |
| Stock page layout | `components/stock/StockView.tsx` |
| Anything about signup gates | `components/stock/SignupGate.tsx` + the button that opens it |
| A new API route | `src/app/api/<name>/route.ts`; mutations need `assertCsrf` |
| A new DB column | `lib/db.ts` — additive `ALTER TABLE` guarded by `PRAGMA table_info` |
| Styling | append a commented section to `app/globals.css`; check phone width |

## 6. Next up

- [ ] **Verify the live feed against the real internet.** Written and
      unit-tested in a sandbox that blocks `query1.finance.yahoo.com` and
      `stooq.com`, so the adapters have never completed a real call. Run
      `npm run verify:prices` on an open network. If Yahoo's shape drifted,
      `lib/providers/yahoo.ts` is the only file to touch.
- [ ] Fundamentals the keyless feeds lack: P/E, EPS, revenue, dividend, shares
      outstanding, earnings date. Needs a licensed feed or SEC company-facts;
      until then those rows are absent rather than invented.
- [ ] Wire the newsletter to an actual send (addresses stored, unsubscribe
      works, nothing is mailed).
- [ ] Contrast audit over `.gsearch-*`, `.act-*`, `.stock-*`, `.news-*`.
- [ ] Sector and market-cap filters on the screens.
- [ ] Republish `docs/tracker.html`.

## 7. Blocked on a decision or a purchase, not on code

Licensed market-data feed (the keyless endpoints are not a redistribution
licence) · licensed news feed (Yahoo gives headlines, no article text) ·
penetration test · lawyer review of the terms · production LLM keys · GitHub
default branch still needs flipping to `main`.

## 8. Traps that have already cost a session

- `better-sqlite3` has no Node 24 prebuild. Use Node 22.
- Stop the running server before `npm ci` on Windows or the native module
  fails to unlink with `EPERM`. A running `next start` also keeps serving the
  *previous* build — which looks exactly like a change that did not take. Kill
  `next-server`, not `next start`.
- Anything scanning the whole universe must be memoised per day
  (`movers.ts`, `trackrecord.ts`). Forgetting it timed out the suite once.
- `min-width: auto` on a flex/grid item turns a scroll container into a
  page-wide overflow. `.card`, `.shell-main`, `.settings-content` carry
  `min-width: 0`; wide content uses `.scroll-x`.
- `flex: none` on a row means `flex-wrap` inside it never fires.
- A redirect for a path under `/dashboard` cannot live in a page there — the
  layout's auth check runs first. Use `redirects()` in `next.config.mjs`.
- `.gitignore` patterns without a leading `/` match at any depth. An
  unanchored `data/` silently swallowed a whole route for weeks.
- Coloured text on a tint of its own hue caps near 4.1:1. Measure the
  composited result, not the token.
- PowerShell: `Out-File -Encoding utf8` writes a BOM that breaks `.env.local`
  (use `ascii`); an unquoted `HEAD@{1}` parses as a hashtable literal; native
  commands ignore `$ErrorActionPreference` — check `$LASTEXITCODE`.
- The cloud sandbox blocks outbound HTTPS to finance hosts. Playwright there
  needs `executablePath: "/opt/pw-browsers/chromium"`.

---

Older detail — what was built and why — lives in `docs/HISTORY.md`.
**Do not read it unless the reasoning behind a decision is actually needed.**
Deeper references, each read only when its subject comes up:
`ARCHITECTURE.md`, `DEPLOY.md`, `OPERATIONS.md`, `RUN-LOCALLY.md`,
`DESIGN.md`, `COSTS.md`, `ROADMAP.md`.
