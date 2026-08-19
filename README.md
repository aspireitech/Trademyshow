# TradeMyShow

**Know exactly why your portfolio moved today.**

TradeMyShow is a SaaS web portal where users group their favorite stocks and receive a daily,
plain-language AI digest explaining the group's move: which holdings drove it, by how much
(exact contribution attribution), and which news was likely behind it. Trend analytics across
1D / 1W / 1M / 3M / 6M / 1Y / 5Y / YTD / all-time. Analytics and education only — never
investment advice, never price predictions.

## Commercial model

| Plan | Price | Key limits |
|---|---|---|
| **Free** | $0 forever | 1 watchlist, 5 stocks, daily insight, score band only |
| **Pro** | $12/mo · $120/yr | 10 watchlists, 30 stocks each, weekly insight, exact scores + breakdown, base rates, email |
| **Premium** | $29/mo · $290/yr | Effectively unlimited watchlists, priority processing |

Every account starts on a **14-day Pro trial with no card**. When it lapses the account
falls back to Free and keeps all its data — nothing is locked away, and there is nothing
to cancel. Trial state is computed (`effectivePlan`), never a stored duplicate, so it
cannot drift out of sync.

## Features

- **Auth** — email/password accounts, bcrypt-hashed, JWT session cookie (httpOnly).
- **Watchlist analysis** — organise favourite stocks into named watchlists and see what
  each holding contributed to the overall move.
- **Individual stock analysis** — look up any stock directly for price, a chart, every
  timeframe at a glance, a plain-language trend read, and its latest news.
- **Multi-timeframe trends** — sparklines and % change across 9 timeframes (1D → all-time).
- **Digest engine** — pure-math attribution: each holding's day move, weight, and exact
  contribution to the group's change. The AI narrates only computed facts, so it can't
  invent numbers.
- **AI writer with automatic failover** — Gemini primary, Anthropic and OpenAI as
  automatic backups, plus a deterministic template fallback. See below.
- **News mapping** — related headlines per holding, aligned to the day's move.
- **Insight Score** — explainable 0–100 signal strength per stock, itemised into news
  sentiment, trend consistency, momentum and stability with weights shown.
- **Base-rate expectations** — "what usually happened next" answered from graded history
  with sample sizes, never a forecast. Suppressed when the sample is too thin.
- **Published track record** — every past score graded against realised returns at 7/30/90
  days, public and unauthenticated.
- **SEO + conversion** — server-rendered landing with JSON-LD (SoftwareApplication +
  FAQPage), sitemap, robots, OG/Twitter metadata, and CSS-only motion (zero client JS).
- **Freemium with trial** — see the commercial model above. Plan gating is enforced
  server-side in every route; the billing route ships as a stub with the Stripe
  integration point documented.

## Lightweight by design

No charting library, no CSS framework, no state-management library. Charts are hand-rolled
inline SVG; styling is plain CSS with custom properties. Page-specific JavaScript is
**1.5–2.9 kB** per route (the ~103 kB shared bundle is the React/Next.js baseline floor),
so screens paint immediately.

## LLM failover: never blocked by a quota wall

Providers are tried in priority order (`LLM_PROVIDER_ORDER`, default
`gemini,anthropic,openai`). Failures are classified and handled differently:

| Failure | Behavior |
|---|---|
| **Rate limit / quota** | Provider goes into cooldown (honouring `Retry-After`), request is served by the next provider immediately. Subsequent requests **skip** the cooling provider entirely rather than re-hitting it. |
| **Transient** (5xx, network) | Retried on the same provider with exponential backoff, then failover. |
| **Auth** (bad key) | Provider disabled for the process — retrying can't help. |
| **Refusal** (safety block) | Fail over; another model may answer. |
| **Malformed request** | **Not** failed over — it would fail everywhere, so the bug surfaces instead of being masked by a bigger bill. |

If every provider is exhausted, digests degrade to the deterministic template writer rather
than erroring. `GET /api/llm/status` reports the live chain: which provider is active,
which are cooling down and for how long, and which are misconfigured.

Add only the keys you have — unconfigured providers are skipped automatically, so the app
runs on Gemini alone, on all three, or on none.

## Quick start

```bash
npm install
cp .env.example .env   # optionally add ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build & serve |
| `npm test` | Unit + API integration tests (vitest, in-memory DB) |
| `npm run test:e2e` | Playwright browser journey against the production build |
| `npm run typecheck` | TypeScript check |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system diagram and tech flow, and
[docs/FLOWS.md](docs/FLOWS.md) for user-flow and digest-pipeline sequence diagrams.

- **Stack**: Next.js 15 (App Router) · TypeScript · SQLite (better-sqlite3) · Anthropic SDK
- **Market data**: deterministic mock provider (seeded random walk) behind a provider
  interface — swap in Finnhub/Polygon/Alpha Vantage in `src/lib/marketdata.ts`.
- **News**: deterministic mock feed behind the same pattern in `src/lib/news.ts`.

## Compliance posture

The product is positioned as analytics/education. The digest writer is systematically
constrained (system prompt + pure-facts input) to never predict prices or advise buying or
selling, and every digest carries a disclaimer. Get a legal review of the disclaimers before
charging real customers.
