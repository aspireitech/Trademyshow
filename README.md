# TradeMyShow

**Know exactly why your portfolio moved today.**

TradeMyShow is a SaaS web portal where users group their favorite stocks and receive a daily,
plain-language AI digest explaining the group's move: which holdings drove it, by how much
(exact contribution attribution), and which news was likely behind it. Trend analytics across
1D / 1W / 1M / 3M / 6M / 1Y / 5Y / YTD / all-time. Analytics and education only — never
investment advice, never price predictions.

## Features

- **Auth** — email/password accounts, bcrypt-hashed, JWT session cookie (httpOnly).
- **Groups** — organize favorite stocks into named groups (watchlists/portfolios).
- **Multi-timeframe trends** — per-stock sparklines and % change across 9 timeframes.
- **Digest engine** — pure-math attribution: each holding's day move, weight, and exact
  contribution to the group's change. The AI narrates only computed facts, so it can't
  invent numbers.
- **AI writer** — Claude (`claude-opus-5`) when `ANTHROPIC_API_KEY` is set, with a
  deterministic template fallback so the app runs fully offline.
- **News mapping** — related headlines per holding, aligned to the day's move.
- **Freemium plans** — Free (1 group, 3 stocks, summary digest) vs Pro (10 groups, 30
  stocks, deep per-holding digest). Billing route ships as a stub with the Stripe
  integration point documented.

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
