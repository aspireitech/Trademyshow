# Operations

How TradeMyShow is run: deployment, the scheduled jobs, backups, and the path
off SQLite when one machine stops being enough.

---

## 1. Environment

Every setting lives in `.env.example` with a comment explaining what breaks
without it. Three are genuinely required in production:

| Variable | Why it must be set |
| --- | --- |
| `AUTH_SECRET` | Signs session JWTs, unsubscribe HMACs, OAuth state and the IP hash salt. Leaving the default lets anyone mint a session. Generate with `openssl rand -hex 32`. |
| `SITE_URL` | Every emailed link and OAuth redirect URI is built from it. Wrong value = links that go nowhere. |
| `CRON_SECRET` | The only thing standing between the public internet and "send every digest now". |

Everything else degrades gracefully: no LLM key falls back to the deterministic
template writer, no mail provider prints to the console, no Stripe key runs
checkout in stub mode, no OAuth credentials hides the social buttons.

## 2. Scheduled jobs

One endpoint drives all recurring work:

```
POST /api/cron?job=market-data     Authorization: Bearer $CRON_SECRET
POST /api/cron?job=daily-digest    Authorization: Bearer $CRON_SECRET
POST /api/cron?job=weekly-digest   Authorization: Bearer $CRON_SECRET
POST /api/cron?job=alerts          Authorization: Bearer $CRON_SECRET
```

Suggested cadence (UTC):

| Job | Schedule | Notes |
| --- | --- | --- |
| `market-data` | `*/10 13-21 * * 1-5` | Every ten minutes through the US session. This is what makes the prices on the board real; without it the site falls back to the simulation and says so. |
| `market-data` | `30 21 * * 1-5` | Once after the close, to settle the day's final prices. |
| `daily-digest` | `0 11 * * 1-5` | ~06:00 US Eastern, before the open. Weekdays only. |
| `weekly-digest` | `0 13 * * 6` | Saturday, when people actually read. |
| `alerts` | `0 * * * *` | Hourly; each alert self-suppresses for 24h after firing. |

Run `market-data` **before** the digest jobs. A digest built on yesterday's
cache explains yesterday's moves.

A refresh is bounded by a wall-clock budget, so an unreachable vendor costs one
skipped run rather than a request that never returns. If the badge on the
market board reads "Simulated", the schedule is the first thing to check —
`GET /api/market/refresh` reports coverage, the provider in use, and the last
run.

The jobs are idempotent by design — a duplicate daily run sends nothing,
because `last_digest_sent_at` gates on a 20-hour window. Retrying a failed run
is always safe.

## 3. Backups

`scripts/backup.sh` takes a consistent SQLite snapshot (via `.backup`, not a
file copy — copying a live SQLite file can capture a torn write), verifies it
with `PRAGMA integrity_check`, and refuses to keep a dump that fails. Run it
from the same scheduler:

```
0 2 * * *  /app/scripts/backup.sh /var/backups/trademyshow
```

Restore is a file move. Test it at least once before you need it; an untested
backup is a hypothesis, not a backup.

**Back up `CONTRACTS_DIR` as well as the database.** The executed agreement PDFs live on disk
while their SHA-256 digests live in SQLite, and the pair is what makes the record tamper-evident.
Losing the files leaves you with hashes of documents you no longer hold — which is to say, no
evidence that anyone accepted anything.

## 4. Scaling: the path off SQLite

SQLite is the right call today. It is a single file, needs no server, survives
restarts, and handles far more traffic than an early-stage product sees. It
stops being the right call at exactly one point: **when you need more than one
application instance.**

### The signals to watch

| Signal | Meaning |
| --- | --- |
| `SQLITE_BUSY` in logs | Write contention. Try WAL mode first (below); it buys a lot of headroom. |
| Digest job exceeding its window | The job is serial and CPU-bound on the LLM calls, not the DB. Parallelise the job before touching the database. |
| Needing a second instance | This is the real trigger. Two processes cannot share a SQLite file safely across a network filesystem. |
| Rate limiting under-counting | The limiter is per-instance; behind a load balancer each instance counts separately. |

### Before migrating, do these

1. **Enable WAL** — `PRAGMA journal_mode=WAL` lets readers and one writer work
   concurrently. This alone removes most `SQLITE_BUSY`.
2. **Set a busy timeout** — `PRAGMA busy_timeout=5000` so a brief lock waits
   instead of erroring.
3. **Move rate limiting to Redis** — `rateLimit()` in `src/lib/security.ts` has
   a deliberately narrow interface (key, rule, now) precisely so its storage can
   be swapped without touching a single call site.

### The migration itself

The whole database surface lives in `src/lib/db.ts`. Nothing else in the
codebase opens a connection or writes SQL — that was the point of routing every
query through named functions. A Postgres port therefore rewrites one file.

**Step 1 — schema.** The DDL is already close to portable. The differences that
matter:

| SQLite | Postgres |
| --- | --- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `GENERATED ALWAYS AS IDENTITY` |
| `datetime('now')` | `now()` |
| `datetime('now', '-30 days')` | `now() - interval '30 days'` |
| `INSERT OR REPLACE` | `INSERT … ON CONFLICT … DO UPDATE` |
| Text timestamps | `timestamptz` — and now they sort correctly and do arithmetic |
| No native boolean | `boolean` instead of `0`/`1` |

**Step 2 — driver.** Replace `better-sqlite3` with `pg`. The one structural
consequence: `better-sqlite3` is synchronous and `pg` is not, so every exported
function in `db.ts` becomes `async` and its callers gain an `await`. TypeScript
finds every one of them — run `tsc --noEmit` and fix what it lists. Do this as
its own commit, with no behaviour changes mixed in.

**Step 3 — placeholders.** SQLite uses `?`, Postgres uses `$1, $2`. Mechanical,
but easy to get subtly wrong on multi-parameter statements; the API tests in
`tests/api.test.ts` cover every table and will catch a mismatch.

**Step 4 — data.** For a small dataset, read every row through the existing
exported functions and write it through the new ones. That path is already
covered by tests, unlike a raw dump-and-load, and it converts types (text
timestamps → `timestamptz`, `0`/`1` → `boolean`) as it goes.

**Step 5 — connection pooling.** Serverless platforms open a connection per
invocation and will exhaust Postgres's limit. Use a pooler (PgBouncer, Neon's
pooled endpoint, Supabase's `?pgbouncer=true`) from the start, not after the
first outage.

### What does *not* change

The route handlers, the insight scoring, the LLM router, the jobs, and every
test above the database layer. That separation is the reason this migration is a
scheduled afternoon rather than a rewrite — and it is worth preserving: if a
future feature reaches for raw SQL in a route handler, that afternoon becomes a
month.

## 5. Monitoring

- **Errors** — set `SENTRY_DSN`. `captureError()` in `src/lib/observability.ts`
  strips email and name before sending; keep it that way.
- **Job health** — `runDigestJob` returns `{considered, sent, skipped, failed,
  reasons}`. Alert on `failed > 0` and on `sent === 0` when `considered > 0`.
- **Deliverability** — watch bounce and complaint rates at the mail provider.
  Above 0.1% complaints, stop sending and find out why before the domain's
  reputation is spent; it recovers far more slowly than it degrades.
- **LLM failover** — `GET /api/llm/status` reports which providers are cooling
  and until when. A primary that is permanently cooling means the quota needs
  raising, not more retries.
