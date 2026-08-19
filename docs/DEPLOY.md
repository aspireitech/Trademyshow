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

### 5. Live market data

```
MARKET_DATA_PROVIDER=finnhub
FINNHUB_API_KEY=...
```

Until then the deterministic mock serves everything and no cached vendor price
is consulted at all. Once switched on:

- live quotes answer "now"; **back-dated requests stay deterministic**, so a
  data refresh cannot rewrite the published track record;
- the cache holds a 26-hour freshness window — past that it falls back to the
  mock rather than serving a stale price as current;
- a symbol the vendor does not cover falls back rather than rendering as zero
  (Finnhub answers unknown symbols with zeroes, not a 404).

**Read the redistribution clause before switching this on.** Several providers'
cheap tiers permit internal analysis only, not display to end users.

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

**Fly.io / Render / Railway** — a persistent volume at `/data` makes SQLite
viable well past early traction. Cheapest and simplest; what the Dockerfile
assumes.

**Vercel** — add the env vars and use Vercel Cron for the jobs, but **SQLite
will not work**: the filesystem is ephemeral and multi-instance. Migrate to
Postgres first (`docs/OPERATIONS.md` §4).

**Any platform** — run a single instance until you migrate off SQLite. Two
instances sharing a SQLite file over a network filesystem will corrupt it.
