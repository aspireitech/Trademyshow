# Build tracker — what's done, what's pending

Single source of truth for launch readiness. Updated 2026-08-19.

**Legend** — ✅ done and tested · 🔨 partially built (works, but not production-grade) · ⬜ not started
**Blocks launch** — Yes means do not take real money or real users without it.

---

## Summary

| Area | Done | Partial | Not started | Blocks launch |
|---|---|---|---|---|
| Core product | 12 | 2 | 4 | 2 |
| Data & AI | 2 | 3 | 2 | 2 |
| Auth & security | 3 | 1 | 12 | 6 |
| Billing & growth | 2 | 1 | 5 | 2 |
| Legal & compliance | 1 | 0 | 5 | 4 |
| Infrastructure | 4 | 1 | 7 | 4 |
| **Total** | **24** | **8** | **35** | **20** |

**24 of 67 components complete (36%).** What exists is genuinely solid — 88 automated tests, typecheck and
build clean. What's missing is mostly the boring, unavoidable production work: real data,
payments, account security, and the legal pages.

---

## 1 · Core product

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Watchlists (create, delete, list) | ✅ | Per-user isolation enforced server-side | — |
| Add/remove stocks | ✅ | 35-symbol universe, search by symbol or name | — |
| Attribution engine | ✅ | Weight × move per holding; contributions sum to the total | — |
| Daily insight | ✅ | Plain-language, AI-narrated over computed facts | — |
| Weekly insight | ✅ | Same maths, week-ago baseline | — |
| Insight Score (0–100) | ✅ | Four weighted components, each itemised | — |
| Base-rate expectations | ✅ | 7/30/90-day history with sample sizes | — |
| Published track record | ✅ | Graded, public, includes misses | — |
| Single-stock analysis | ✅ | Chart, 9 timeframes, news, score | — |
| Multi-timeframe trends | ✅ | 1D → all-time, SVG sparklines | — |
| Light/dark theming | ✅ | Light default, no-flash, AA contrast both ways | — |
| Colour-coded insight data | ✅ | Component bars, band chips, sentiment dots, severity stripes | — |
| Scheduled email delivery | ⬜ | **The habit loop.** Nightly job + templates + unsubscribe | **Yes** |
| Onboarding flow | 🔨 | Works but no guided first-run; empty states are thin | — |
| Mobile responsive audit | 🔨 | CSS is responsive; not tested on real devices | **Yes** |
| Multi-asset (ETFs, crypto, etc.) | ⬜ | Stocks only today | — |
| Alerts (score crosses a threshold) | ⬜ | Natural Pro feature, drives retention | — |
| In-app notification centre | ⬜ | — | — |

## 2 · Data & AI

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Multi-provider LLM router | ✅ | Gemini → Anthropic → OpenAI, auto-failover on quota | — |
| Template fallback writer | ✅ | Product never hard-fails when AI is unavailable | — |
| News → score pipeline | 🔨 | **Architecture is real, the feed is mock.** 30% of the score | **Yes** |
| Market data provider | 🔨 | Deterministic mock; adapter seam ready at `src/lib/marketdata.ts` | **Yes** |
| AI narration | 🔨 | Works; needs a real API key to produce non-template prose | — |
| Real-time / intraday prices | ⬜ | Currently end-of-day style | — |
| Earnings calendar | ⬜ | Strong signal source, not yet ingested | — |

## 3 · Auth & security

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Email + password auth | ✅ | bcrypt (cost 10) | — |
| Session management | ✅ | JWT in httpOnly, SameSite=Lax, Secure in prod | — |
| Server-side authorisation | ✅ | Every route checks ownership, not just login | — |
| Password rules | 🔨 | Min 8 chars only; no breach check or strength meter | — |
| **Email verification (OTP)** | ⬜ | Confirm address before insights are delivered | **Yes** |
| **Password reset** | ⬜ | **Currently no way to recover an account** | **Yes** |
| **Rate limiting / brute force** | ⬜ | Login, register and AI routes are all unthrottled | **Yes** |
| **Social login** (Google, Apple) | ⬜ | Apple is mandatory on iOS if you ship an app | — |
| SMS OTP / 2FA | ⬜ | TOTP is cheaper and safer than SMS; do TOTP first | — |
| Security headers (CSP, HSTS) | ⬜ | One-off config, high value | **Yes** |
| CSRF protection | ⬜ | SameSite helps but is not sufficient alone | **Yes** |
| Session revocation / devices | ⬜ | "Log out everywhere" | — |
| Account deletion + data export | ⬜ | Legally required under GDPR/CCPA | **Yes** |
| Audit log | ⬜ | Who changed what, when | — |
| Dependency scanning | ⬜ | Dependabot or similar | — |
| Penetration test | ⬜ | Before taking payment | — |

## 4 · Billing & growth

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Plan tiers & limits | ✅ | Free / Pro $12 / Premium $29, enforced server-side | — |
| 14-day no-card trial | ✅ | Computed, not stored — cannot drift | — |
| Stripe checkout | 🔨 | **Stub flips the plan directly.** Seam documented | **Yes** |
| Stripe webhooks | ⬜ | Renewals, failed payments, cancellations | **Yes** |
| Referral programme | ⬜ | Codes, attribution, commission ledger, payouts | — |
| Promo codes | ⬜ | — | — |
| Admin panel | ⬜ | Users, revenue, churn, tier mix — you have zero visibility today | — |
| Product analytics | ⬜ | Activation and retention funnel | — |

## 5 · Legal & compliance

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Not-advice positioning | ✅ | Enforced in prompt, product copy and disclaimers | — |
| Terms of Service | ⬜ | Required before charging | **Yes** |
| Privacy Policy | ⬜ | Required by GDPR/CCPA and by Stripe | **Yes** |
| Cookie consent | ⬜ | Needed if you add analytics in the EU | — |
| Lawyer review of disclaimers | ⬜ | Publisher-exemption posture should be confirmed | **Yes** |
| Market-data licence review | ⬜ | Redistribution terms vary sharply by provider | **Yes** |

## 6 · Infrastructure

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Automated tests | ✅ | 88 unit/integration + 2 e2e journeys | — |
| Typecheck + build | ✅ | Clean | — |
| SEO foundation | ✅ | JSON-LD, sitemap, robots, OG/Twitter, canonical | — |
| Deterministic test data | ✅ | Same date always gives the same numbers | — |
| Database | 🔨 | SQLite; fine for MVP, swap to Postgres at scale | — |
| Hosting / deployment | ⬜ | Vercel or similar | **Yes** |
| CI/CD pipeline | ⬜ | Run tests on every push | **Yes** |
| Backups + restore drill | ⬜ | An untested backup is not a backup | **Yes** |
| Error tracking (Sentry) | ⬜ | — | **Yes** |
| Uptime monitoring | ⬜ | — | — |
| Staging environment | ⬜ | — | — |
| Log aggregation | ⬜ | — | — |

---

## Recommended order

**Phase 1 — make it real (2–3 weeks).** Real market data, real news feed, Stripe checkout
plus webhooks, hosting and CI. Without these there is no product to sell.

**Phase 2 — make it safe (1–2 weeks).** Password reset, email verification, rate limiting,
security headers, CSRF, account deletion, Terms and Privacy. Most of this is unglamorous
and all of it is non-negotiable before real users.

**Phase 3 — make it stick (2 weeks).** Scheduled email digests (the single biggest
retention lever — the daily habit is the product), alerts, onboarding polish, admin panel.

**Phase 4 — make it grow.** Referrals, promo codes, multi-asset, analytics.

The two most commonly underestimated items on this list are **password reset** (users
*will* lock themselves out on day one) and **scheduled email** (without it, people simply
forget to come back — which is exactly the churn pattern visible in competitors' numbers).
