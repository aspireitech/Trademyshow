# Build tracker — what's done, what's pending

Single source of truth for launch readiness. Updated 2026-08-19.

**Legend** — ✅ done and tested · 🔨 partially built (works, but not production-grade) · ⬜ not started
**Blocks launch** — Yes means do not take real money or real users without it.

---

## Summary

| Area | Done | Partial | Not started | Blocks launch |
|---|---|---|---|---|
| Core product | 17 | 1 | 1 | 0 |
| Data & AI | 2 | 3 | 2 | 2 |
| Auth & security | 15 | 0 | 1 | 1 |
| Billing & growth | 7 | 1 | 0 | 1 |
| Legal & compliance | 4 | 0 | 2 | 2 |
| Infrastructure | 9 | 1 | 2 | 1 |
| **Total** | **54** | **6** | **8** | **7** |

**54 of 68 components complete (79%).** 199 automated tests plus 18 end-to-end journeys;
typecheck and production build clean.

**The seven remaining blockers split into two kinds.** Two are code — wiring a real market-data
feed and a real news feed in place of the deterministic mocks. Five cannot be written by anyone
sitting at this keyboard: a lawyer's review of the disclaimers, a market-data redistribution
licence, a penetration test, an actual hosting deployment, and live API keys. Those five are
decisions and purchases, not tickets.

---

## 1 · Core product

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Watchlists (create, delete, list) | ✅ | Per-user isolation enforced server-side | — |
| Add/remove stocks | ✅ | Search by symbol, name or sector | — |
| Attribution engine | ✅ | Weight × move per holding; contributions sum to the total | — |
| Daily insight | ✅ | Plain-language, AI-narrated over computed facts | — |
| Weekly insight | ✅ | Same maths, week-ago baseline | — |
| Insight Score (0–100) | ✅ | Four weighted components, each itemised | — |
| Base-rate expectations | ✅ | 7/30/90-day history with sample sizes | — |
| Published track record | ✅ | Graded, public, includes misses and ungraded calls | — |
| Single-stock analysis | ✅ | Chart, 9 timeframes, news, score | — |
| Multi-timeframe trends | ✅ | 1D → all-time, SVG sparklines | — |
| Light/dark theming | ✅ | Light default, no-flash, AA contrast both ways | — |
| Colour-coded insight data | ✅ | Component bars, band chips, sentiment dots, severity stripes | — |
| Scheduled email delivery | ✅ | Daily + weekly jobs, three send gates, one-click unsubscribe | — |
| Alerts (score crosses a threshold) | ✅ | 24h suppression so a hovering score cannot spam | — |
| In-app notification centre | ✅ | Alert hits land as readable notifications | — |
| Multi-asset (ETFs, crypto) | ✅ | 17 funds and 3 coins alongside 35 equities, one scoring model | — |
| Mobile responsive audit | ✅ | Playwright at iPhone viewport; asserts no horizontal page scroll | — |
| Onboarding flow | 🔨 | Empty states now suggest starting points; no guided tour yet | — |
| Real-time / intraday prices | ⬜ | Currently end-of-day style | — |

## 2 · Data & AI

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Multi-provider LLM router | ✅ | Gemini → Anthropic → OpenAI, auto-failover on quota | — |
| Template fallback writer | ✅ | Product never hard-fails when AI is unavailable | — |
| News → score pipeline | 🔨 | **Architecture is real, the feed is mock.** 30% of the score | **Yes** |
| Market data provider | 🔨 | Deterministic mock; adapter seam ready at `src/lib/marketdata.ts` | **Yes** |
| AI narration | 🔨 | Works; needs a real API key to produce non-template prose | — |
| Earnings calendar | ⬜ | Strong signal source, not yet ingested | — |
| Sector/peer comparison | ⬜ | "Is this move the stock or the sector?" | — |

## 3 · Auth & security

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Email + password auth | ✅ | bcrypt (cost 10) | — |
| Session management | ✅ | JWT in httpOnly, SameSite=Lax, Secure in prod, `jti` recorded | — |
| Server-side authorisation | ✅ | Every route checks ownership, not just login | — |
| Password rules | ✅ | 10+ chars, mixed case, number/symbol, common-password list incl. mutations | — |
| Email verification (OTP) | ✅ | Link or 6-digit code; delivery gated on it | — |
| Password reset | ✅ | Hashed single-use token, 60min, revokes every session on use | — |
| Rate limiting / brute force | ✅ | Per-route, per-IP-hash fixed window; raw IPs never stored | — |
| Social login (Google, Apple) | ✅ | OIDC, signed state, env-gated; refuses unverified provider emails | — |
| TOTP two-factor | ✅ | RFC 6238 from scratch, passes the RFC's own test vectors | — |
| Security headers (CSP, HSTS) | ✅ | Nonce CSP wired the way Next actually consumes it, HSTS 2yr | — |
| CSRF protection | ✅ | Double-submit cookie on every mutating route | — |
| Session revocation / devices | ✅ | Device list, revoke one, "sign out everywhere else" | — |
| Account deletion + data export | ✅ | Password-confirmed deletion; full JSON export | — |
| Audit log | ✅ | Security events with hashed IPs; never breaks the request it logs | — |
| Dependency scanning | ✅ | Dependabot weekly | — |
| SMS OTP | ⬜ | Deliberately skipped — SIM-swap makes it weaker than the TOTP above | — |
| Penetration test | ⬜ | **Not a code task.** Book before taking payment | **Yes** |

## 4 · Billing & growth

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Plan tiers & limits | ✅ | Free / Pro $12 / Premium $29, enforced server-side | — |
| 14-day no-card trial | ✅ | Computed, not stored — cannot drift | — |
| Stripe checkout | ✅ | Real session creation; stub mode without a key | — |
| Stripe webhooks | ✅ | Signature verified, replays rejected outside a 5-minute window | — |
| Referral programme | ✅ | Codes, attribution, 20% commission ledger, self-referral blocked | — |
| Promo codes | ✅ | Percent off, expiry, redemption cap | — |
| Admin panel | ✅ | MRR, ARPU, conversion, verified share, usage | — |
| Product analytics | ✅ | Event capture, gated on consent | — |
| Live Stripe keys + payout account | 🔨 | **Not a code task.** Code is ready; the account is not | **Yes** |

## 5 · Legal & compliance

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Not-advice positioning | ✅ | Enforced in prompt, product copy and disclaimers | — |
| Terms of Service | ✅ | Published, flagged as unreviewed | — |
| Privacy Policy | ✅ | Published, flagged as unreviewed | — |
| Cookie consent | ✅ | Gates analytics only; `track()` checks it, so declining is real | — |
| Lawyer review of disclaimers | ⬜ | **Not a code task.** Publisher-exemption posture needs confirming | **Yes** |
| Market-data licence review | ⬜ | **Not a code task.** Redistribution terms vary sharply | **Yes** |

## 6 · Infrastructure

| Component | Status | Notes | Blocks launch |
|---|---|---|---|
| Automated tests | ✅ | 199 unit/integration + 18 e2e journeys | — |
| Typecheck + build | ✅ | Clean | — |
| SEO foundation | ✅ | JSON-LD, sitemap, robots, OG/Twitter, canonical | — |
| Deterministic test data | ✅ | Same date always gives the same numbers | — |
| CI/CD pipeline | ✅ | Typecheck, unit and e2e on every push | — |
| Backups + restore drill | ✅ | Consistent snapshot, integrity-checked, refuses a bad dump | — |
| Error tracking (Sentry) | ✅ | DSN-gated; strips email and name before sending | — |
| Scheduled job runner | ✅ | One authenticated cron endpoint drives all recurring work | — |
| Postgres migration path | ✅ | Documented step by step in `docs/OPERATIONS.md` | — |
| Database | 🔨 | SQLite. Correct until you need a second instance | — |
| Hosting / deployment | ⬜ | **Not a code task.** Vercel or similar | **Yes** |
| Staging environment | ⬜ | — | — |

---

## What to do next, in order

**1 — Buy the two feeds (blocks everything).** A market-data provider and a news provider.
Both have adapter seams waiting; the code change is small, the licence reading is not. Check
redistribution terms before signing: several providers forbid showing prices to end users on
the cheap tier, which is the plan the pricing assumes.

**2 — Deploy and connect Stripe.** Hosting, live keys, a payout account. Then run one real
transaction end to end and one real refund, before anyone else does.

**3 — Get the disclaimers reviewed.** The "we publish analysis, we do not advise" posture is
what keeps this outside investment-adviser registration. It is the single legal question worth
paying for, and it is cheap relative to being wrong.

**4 — Book a penetration test.** Everything on the security list above is built and tested,
which is exactly the point at which an outside pair of eyes becomes worth the money.

**5 — Then, and only then, market it.** Onboarding polish, earnings calendar, peer comparison,
intraday prices. All of it is worth doing; none of it matters if the four items above are open.

---

## A note on what "done" means here

Every ✅ above is backed by tests that fail when the behaviour breaks — not by a screenshot.
Two examples worth knowing about, because both were live defects found by writing those tests:

- **The CSP blocked every script in production.** A nonce was minted but never reached Next,
  so `strict-dynamic` refused the entire bundle. The site rendered and did nothing. Development
  was unaffected, which is why it survived until an end-to-end run against a production build.
- **The unsubscribe link verified the user's email address.** It reused the verification token
  helper. Anyone clicking "unsubscribe" would have confirmed their address instead of stopping
  the mail.

Neither would have been caught by reading the code, and both were shipped-looking before the
test existed.
