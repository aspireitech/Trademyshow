# Architecture

## System overview

```mermaid
flowchart LR
    subgraph Client["Browser (React / Next.js)"]
        L[Landing / Pricing]
        A[Auth pages]
        D[Dashboard: groups]
        G[Group detail: holdings, trends, digest]
    end

    subgraph Server["Next.js server (App Router)"]
        subgraph API["API routes"]
            AuthAPI["/api/auth/*"]
            GroupsAPI["/api/groups/*"]
            StocksAPI["/api/stocks/*"]
            DigestAPI["/api/groups/:id/digest"]
            BillingAPI["/api/billing/*"]
        end
        subgraph Lib["Domain libraries"]
            AuthLib["auth.ts (bcrypt + JWT cookie)"]
            Plans["plans.ts (free/pro gating)"]
            Engine["digest/engine.ts (attribution math)"]
            Writer["digest/writer.ts (AI narration)"]
            MD["marketdata.ts (provider interface)"]
            News["news.ts (provider interface)"]
        end
        DB[(SQLite - better-sqlite3)]
    end

    subgraph External["External services"]
        Claude["Anthropic API - claude-opus-5"]
        RealMD["Real market data - Finnhub / Polygon (adapter point)"]
        RealNews["Real news feed - NewsAPI / Benzinga (adapter point)"]
        Stripe["Stripe (integration point)"]
    end

    Client -->|fetch JSON| API
    AuthAPI --> AuthLib --> DB
    GroupsAPI --> Plans
    GroupsAPI --> DB
    StocksAPI --> MD
    DigestAPI --> Engine --> MD
    Engine --> News
    DigestAPI --> Writer --> Claude
    DigestAPI --> DB
    BillingAPI -.-> Stripe
    MD -.-> RealMD
    News -.-> RealNews
```

## Tech flow: request lifecycle

```mermaid
flowchart TD
    R[HTTP request] --> C{Session cookie valid?}
    C -- no --> E401[401 / redirect to /login]
    C -- yes --> P{Plan limits OK?}
    P -- no --> E403[403 with upgrade prompt]
    P -- yes --> H[Route handler]
    H --> DOM[Domain library call]
    DOM --> DB[(SQLite)]
    DOM --> EXT[Provider: market data / news / Claude]
    H --> J[JSON response]
```

## LLM provider failover

The digest writer never calls a provider SDK directly — it calls the router, which owns
priority order, error classification, cooldown state and retries.

```mermaid
flowchart TD
    Req[writeDigest facts] --> R{Router: next eligible provider}
    R -->|none eligible| T[Template writer - deterministic fallback]
    R --> P[Call provider]
    P -->|success| Done[Return prose + provider name]
    P -->|error| C{Classify failure}
    C -->|rate_limit| CD[Cooldown provider - honour Retry-After] --> R
    C -->|transient| RT{Retries left?}
    RT -->|yes| BO[Exponential backoff] --> P
    RT -->|no| R
    C -->|auth| DIS[Disable provider for process] --> R
    C -->|refusal| R
    C -->|permanent| TH[Throw - malformed request fails everywhere]
```

Cooldown state is held on a process-wide router instance deliberately: knowing "Gemini is
rate limited until 14:32" is only useful if every request shares that knowledge. The
classifier reads HTTP status codes and message patterns rather than SDK-specific error
classes, so a provider SDK upgrade cannot silently break failover.

## Key design decisions

| Decision | Rationale |
|---|---|
| **Facts-first digest** — pure math in `engine.ts`, AI only narrates | The AI can never invent numbers; wrong-number risk and compliance risk drop sharply. |
| **No predictions by design** | System prompt + product copy forbid buy/sell advice and price predictions. This is the compliance moat (publisher exemption posture). |
| **Deterministic mock providers** | Whole app runs with zero API keys; tests are reproducible; real providers are drop-in adapters. |
| **Template writer fallback** | Digest generation never hard-fails: no key, API error, or safety refusal all degrade gracefully. |
| **SQLite first** | Zero-ops MVP. The `db.ts` repository layer isolates SQL, so Postgres is a contained swap when scale demands. |
| **Plan gating in one module** | `plans.ts` is the single source of truth for free/pro limits, enforced server-side in every route. |

## Scaling path (post-MVP)

1. SQLite → Postgres (swap `db.ts` internals; schema is portable).
2. On-demand digests → nightly batch job per user (queue + cron), delivered by email.
3. Mock providers → licensed market data + news APIs with caching layer (Redis).
4. Billing stub → Stripe Checkout + webhooks (`/api/billing` already marks the seam).
5. Add broker linking (Plaid/SnapTrade) so digests use real positions, not just watchlists.
