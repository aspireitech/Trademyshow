# Deploying

Two targets, and they are genuinely different things. **Sandbox** is a public
demonstration with no real money, no market-data licence and no real email.
**Production** is the same code with real credentials and the legal work done.

---

## Sandbox — one command

```bash
docker compose up --build
```

Open http://localhost:3000 and register; the sandbox works empty. To start with
demo accounts and a fortnight of back-dated insights instead:

```bash
npm ci
npm run build
npm run seed          # 2 accounts, 3 watchlists, 45 back-dated insights
SANDBOX=true npm start
```

| Account | Email | Password |
| --- | --- | --- |
| Demo user (Premium) | `demo@trademyshow.com` | `Sandbox!Demo2026` |
| Admin (metrics view) | `admin@trademyshow.com` | `Sandbox!Admin2026` |

### What sandbox mode changes

`SANDBOX=true` is read explicitly rather than inferred from `NODE_ENV`, because
a sandbox *is* a production build. It:

- renders a permanent banner stating prices are generated, not real market data;
- suppresses outbound email to the console, so demo signups with throwaway
  addresses never touch the sending domain's reputation;
- **refuses a live Stripe key**, falling back to stub checkout — an `sk_live_`
  key in a demo would charge a real card;
- prints the demo credentials on every page, so nobody has to be told them.

Set `SANDBOX_ALLOW_EMAIL=true` if you specifically want to test delivery.

---

## Health check

`GET /api/health` — unauthenticated, safe to expose, reports no credentials.

```json
{
  "status": "ok",
  "sandbox": true,
  "checks": { "database": true, "authSecretSet": true, "legalIdentitySet": false },
  "warnings": ["Legal identity unset: companyName, ..."]
}
```

`status` is `ok` whenever the app can serve requests. The `warnings` array is
the launch-readiness checklist — deliberately **not** part of the status code,
because a missing Stripe key is a gap, not an outage, and failing health on it
would take a working demo offline.

Point your orchestrator's liveness probe here. The Dockerfile already does.

---

## Production checklist

The health endpoint tells you which of these are still missing.

### 1. Secrets

```bash
openssl rand -hex 32   # AUTH_SECRET
openssl rand -hex 32   # CRON_SECRET
```

`AUTH_SECRET` signs sessions, unsubscribe links, OAuth state and the IP-hash
salt. Leaving it at the default lets anyone mint a session for any account.

### 2. Legal identity

`LEGAL_COMPANY_NAME`, `LEGAL_COMPANY_NUMBER`, `LEGAL_ADDRESS`,
`LEGAL_GOVERNING_LAW`, `LEGAL_FORUM`, `LEGAL_CONTACT_EMAIL`.

While unset, the Terms page renders a warning naming each missing value and the
placeholders appear verbatim in every executed-agreement PDF. Do not launch
past this.

### 3. Persistent storage

Two things must survive a restart, and must be backed up **together**:

| Path | Contents |
| --- | --- |
| `DB_PATH` | Accounts, watchlists, insights, contract hashes |
| `CONTRACTS_DIR` | The executed-agreement PDFs |

The hashes live in the database and the files on disk; that pairing is what
makes the records tamper-evident. Losing the files leaves you holding hashes of
documents you no longer have. The Docker image mounts both under `/data`.

### 4. Scheduled jobs

```
POST /api/cron?job=market-data       Authorization: Bearer $CRON_SECRET
POST /api/cron?job=digest&period=daily
POST /api/cron?job=digest&period=weekly
POST /api/cron?job=alerts
POST /api/cron?job=purge
```

Run `market-data` **before** `digest` — a digest built on yesterday's cache
explains yesterday's moves. Suggested UTC schedule in `docs/OPERATIONS.md`.
All jobs are idempotent; retrying a failed run is always safe.

### 5. Market data

**Live is the default. There is nothing to configure to get real prices.**

`MARKET_DATA_PROVIDER` decides who answers:

| Value | Who answers | Key needed |
| --- | --- | --- |
| *(unset)* or `auto` | Yahoo Finance, then Stooq, then Finnhub if a key exists | no |
| `yahoo` | Yahoo Finance only | no |
| `stooq` | Stooq end-of-day files only | no |
| `finnhub` | Finnhub only | `FINNHUB_API_KEY` |
| `mock` | Nobody — the simulation, labelled as such on every screen | no |

Nothing renders straight from a vendor. A refresh job fills a local cache and
every page reads that, synchronously, which is what keeps scoring and digest
generation pure functions over a snapshot.

**Fill the cache after install, then keep it filled:**

```
npm run refresh:history     # once: quotes + five years of daily closes
npm run refresh             # every few minutes during market hours
```

or, over HTTP, `POST /api/cron?job=market-data` with the `CRON_SECRET`. The
landing page will also ask the server to fill an empty cache by itself on the
first visit, so a fresh install shows real prices without anyone reading this
file — but that is a convenience, not a substitute for the schedule.

Once data is flowing:

- live quotes answer "now"; **back-dated requests stay deterministic**, so a
  data refresh cannot rewrite the published track record;
- the cache holds a 26-hour freshness window — past that a quote is relabelled
  "end-of-day close" or falls back to the simulation, never served as current;
- a symbol no vendor covers falls back to the simulation and the page says so;
- market cap is the vendor's where it publishes one, and otherwise our own
  estimate (live price × stored share count), marked with an asterisk.

**On the keyless endpoints.** Yahoo's chart and search endpoints are the ones
its own website calls, and Stooq publishes CSV files. Neither is a commercial
data licence: prices are treated as delayed, nothing is redistributed as a
feed, and the whole path degrades to the simulation if either changes. When a
licence is bought, `src/lib/providers/` is the only place that changes.

**Read the redistribution clause before paying for anything.** Several
providers' cheap tiers permit internal analysis only, not display to end users.

### 6. Everything else

| Variable | Without it |
| --- | --- |
| `GEMINI_API_KEY` | Insights use the deterministic template writer |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Checkout runs in stub mode |
| `RESEND_API_KEY` or `SMTP_URL` | Email prints to the console |
| `GOOGLE_CLIENT_ID` / `_SECRET` | Google button does not render |
| `SENTRY_DSN` | Errors go to stdout only |

Every one degrades gracefully. The app never fails to boot because a provider
is missing — it reports it in `/api/health` instead.

---

## Platform notes

**Azure** — step-by-step in [`DEPLOY-AZURE.md`](./DEPLOY-AZURE.md), including
the SQLite-on-SMB trap that makes App Service's persistent `/home` and Container
Apps' Azure Files volumes the wrong storage for this app.

**Fly.io / Render / Railway** — a persistent volume at `/data` makes SQLite
viable well past early traction. Cheapest and simplest; what the Dockerfile
assumes.

**Vercel** — add the env vars and use Vercel Cron for the jobs, but **SQLite
will not work**: the filesystem is ephemeral and multi-instance. Migrate to
Postgres first (`docs/OPERATIONS.md` §4).

**Any platform** — run a single instance until you migrate off SQLite. Two
instances sharing a SQLite file over a network filesystem will corrupt it.
