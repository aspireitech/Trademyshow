# Deploying to Azure

Step by step, with the commands. Read §1 first — the storage decision is the
one that bites, and it is easier to make now than to unpick later.

---

## 1 · Pick the right service (the SQLite problem)

TradeMyShow stores data in **SQLite**, a single file. That choice is correct at
this stage and wrong on most of Azure's convenient options, for two reasons
that are easy to miss until data is already corrupt:

1. **SQLite over SMB is unsafe.** Azure Files is SMB. SQLite's locking relies on
   filesystem semantics that SMB does not reliably provide, and the documented
   failure mode is a corrupted database, not an error message. Azure App
   Service's persistent `/home` and Container Apps' Azure Files volumes are both
   SMB.
2. **Two replicas sharing one SQLite file will corrupt it.** Anything that
   autoscales must be pinned to exactly one instance.

That leaves three honest options:

| Option | Storage | Good for | Cost/month |
| --- | --- | --- | --- |
| **A · Container Apps, ephemeral** | None — resets on restart | **Sandbox demos** | ~$0–20 |
| **B · VM + managed disk** | Real block storage, SQLite-safe | Small production | ~$15–40 |
| **C · App Service + Postgres** | Azure Database for PostgreSQL | Production at scale | ~$40–90 |

**For a sandbox, take option A and do not fight it.** A demo that resets
nightly is a *feature*: it stays clean, cannot accumulate junk accounts, and the
seed endpoint rebuilds it in one call. Option A is what §2 walks through.

Option C needs the Postgres migration in `docs/OPERATIONS.md` §4 first — one
file, `src/lib/db.ts`. Do not attempt Postgres and Azure on the same day.

---

## 2 · Sandbox on Azure Container Apps

About 15 minutes. **You do not need Docker installed** — `az acr build` builds
the image in Azure.

### 2.1 Install and sign in

```bash
# macOS: brew install azure-cli   |   Windows: winget install Microsoft.AzureCLI
az login
az account set --subscription "<your-subscription-id>"
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

### 2.2 Variables

Set these once; everything below reuses them.

```bash
RG=trademyshow-rg
LOC=eastus                      # or westeurope, uksouth …
ACR=trademyshowacr$RANDOM       # must be globally unique, lowercase alphanumeric
ENV=trademyshow-env
APP=trademyshow-sandbox

AUTH_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 32)
```

### 2.3 Resource group and registry

```bash
az group create --name $RG --location $LOC

az acr create --resource-group $RG --name $ACR --sku Basic --admin-enabled true
```

### 2.4 Build the image in Azure

```bash
az acr build --registry $ACR --image trademyshow:v1 .
```

This uploads the build context and builds remotely. It is also the first real
test of the Dockerfile — if it fails, the error is a normal Docker build error
and the fix is local.

### 2.5 Container Apps environment

```bash
az containerapp env create \
  --name $ENV --resource-group $RG --location $LOC
```

### 2.6 Deploy

```bash
az containerapp create \
  --name $APP \
  --resource-group $RG \
  --environment $ENV \
  --image $ACR.azurecr.io/trademyshow:v1 \
  --registry-server $ACR.azurecr.io \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 1 \
  --cpu 0.5 --memory 1.0Gi \
  --secrets auth-secret=$AUTH_SECRET cron-secret=$CRON_SECRET \
  --env-vars \
    SANDBOX=true \
    NODE_ENV=production \
    AUTH_SECRET=secretref:auth-secret \
    CRON_SECRET=secretref:cron-secret \
    MARKET_DATA_PROVIDER=mock \
    DB_PATH=/tmp/trademyshow.db \
    CONTRACTS_DIR=/tmp/contracts \
    LEGAL_COMPANY_NAME="TradeMyShow Sandbox" \
    LEGAL_COMPANY_NUMBER="SANDBOX-0000" \
    LEGAL_ADDRESS="Sandbox deployment — not a real address" \
    LEGAL_GOVERNING_LAW="England and Wales" \
    LEGAL_FORUM="London" \
    LEGAL_CONTACT_EMAIL="legal@example.com"
```

Three details that matter:

- **`--min-replicas 1 --max-replicas 1`.** Not optional. Two replicas sharing a
  SQLite file corrupts it, and scale-to-zero would wipe the demo on every idle
  period.
- **`secretref:`** keeps `AUTH_SECRET` out of `az containerapp show` output and
  out of the portal's plain env-var list.
- **`/tmp`** is deliberate: ephemeral, local, and not SMB. The data resets when
  the container restarts, which is the intended behaviour for a sandbox.

Get the URL:

```bash
az containerapp show --name $APP --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv
```

### 2.7 Confirm it is healthy

```bash
APP_URL=https://$(az containerapp show --name $APP --resource-group $RG \
  --query properties.configuration.ingress.fqdn -o tsv)

curl -s $APP_URL/api/health | jq
```

Expect `"status": "ok"` and `"sandbox": true`. The `warnings` array lists what
is still unconfigured — for a sandbox, warnings about Stripe, mail and market
data are all expected and correct.

### 2.8 Seed the demo data

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/cron?job=seed" | jq
```

Creates two accounts, three watchlists and 45 back-dated insights. Idempotent,
and refused outright unless `SANDBOX=true` — those accounts have passwords
printed on the landing page.

Open `$APP_URL` and sign in as `demo@trademyshow.com` / `Sandbox!Demo2026`.

---

## 3 · Scheduled jobs

Container Apps Jobs run on a cron schedule in the same environment. One job per
schedule; each is a `curl` at the cron endpoint.

```bash
az containerapp job create \
  --name trademyshow-daily-digest \
  --resource-group $RG --environment $ENV \
  --trigger-type Schedule \
  --cron-expression "0 11 * * 1-5" \
  --replica-timeout 600 \
  --image mcr.microsoft.com/azure-cli:latest \
  --cpu 0.25 --memory 0.5Gi \
  --secrets cron-secret=$CRON_SECRET \
  --env-vars CRON_SECRET=secretref:cron-secret APP_URL=$APP_URL \
  --command "/bin/sh" \
  --args "-c","curl -sf -X POST -H \"Authorization: Bearer \$CRON_SECRET\" \"\$APP_URL/api/cron?job=digest&period=daily\""
```

Repeat with:

| Job | Cron (UTC) | Query |
| --- | --- | --- |
| Market data | `30 10 * * 1-5` | `job=market-data` |
| Daily digest | `0 11 * * 1-5` | `job=digest&period=daily` |
| Weekly digest | `0 13 * * 6` | `job=weekly` → `job=digest&period=weekly` |
| Alerts | `0 * * * *` | `job=alerts` |
| Purge tokens | `0 3 * * *` | `job=purge` |

**Run market data before the digest.** A digest built on yesterday's cache
explains yesterday's moves. On a mock-data sandbox the market-data job is a
no-op, so it can be skipped until you have a real key.

---

## 4 · Custom domain and TLS

Container Apps issues and renews a managed certificate free.

```bash
# 1. Add a CNAME at your DNS provider:
#      www.yourdomain.com  ->  <the FQDN from 2.6>
# 2. Add a TXT record for asuid.www with the verification id:
az containerapp show --name $APP --resource-group $RG \
  --query properties.customDomainVerificationId -o tsv

# 3. Bind it and let Azure issue the certificate:
az containerapp hostname add --hostname www.yourdomain.com --name $APP --resource-group $RG
az containerapp hostname bind --hostname www.yourdomain.com --name $APP --resource-group $RG \
  --environment $ENV --validation-method CNAME
```

Then update the app so emails and OAuth callbacks point at the real host:

```bash
az containerapp update --name $APP --resource-group $RG \
  --set-env-vars SITE_URL=https://www.yourdomain.com
```

`SITE_URL` is wrong-by-default until you do this: every emailed link and OAuth
redirect URI is built from it.

---

## 5 · Logs and monitoring

```bash
# Live tail
az containerapp logs show --name $APP --resource-group $RG --follow

# Query the last hour of errors
az monitor log-analytics query \
  --workspace $(az containerapp env show --name $ENV --resource-group $RG \
    --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv) \
  --analytics-query "ContainerAppConsoleLogs_CL | where TimeGenerated > ago(1h) | where Log_s contains 'error' | take 50"
```

Set `SENTRY_DSN` for structured error tracking; `captureError()` strips email
and name before sending.

---

## 6 · Updating

```bash
az acr build --registry $ACR --image trademyshow:v2 .
az containerapp update --name $APP --resource-group $RG \
  --image $ACR.azurecr.io/trademyshow:v2
```

Container Apps does a rolling revision swap. **With `--min-replicas 1
--max-replicas 1` there is a brief gap during the swap** — acceptable for a
sandbox, and the reason production wants Postgres so replicas can overlap.

Roll back:

```bash
az containerapp revision list --name $APP --resource-group $RG -o table
az containerapp revision activate --revision <previous-revision> --resource-group $RG
```

---

## 7 · Cost

Sandbox, one replica at 0.5 vCPU / 1 GiB, running continuously:

| Item | Approx/month |
| --- | --- |
| Container Apps (1 replica, always on) | $15–25 |
| Container Registry (Basic) | $5 |
| Log Analytics (low volume) | $0–5 |
| **Total** | **~$20–35** |

Container Apps includes a monthly free grant of vCPU-seconds and requests that
covers a good share of a small sandbox, so real bills often land at the lower
end. Scale-to-zero would cut it further but wipes the demo data on every idle
period — for a link you want to send people, keep one replica warm.

Set a budget alert before you forget:

```bash
az consumption budget create --budget-name trademyshow-cap --amount 50 \
  --time-grain Monthly --category Cost \
  --start-date $(date +%Y-%m-01) --end-date $(date -d '+1 year' +%Y-%m-01)
```

---

## 8 · Going from sandbox to production

In order:

1. **Migrate to Postgres.** `az postgres flexible-server create`, then the
   migration in `docs/OPERATIONS.md` §4. This is what unlocks more than one
   replica, which unlocks zero-downtime deploys.
2. **Drop `SANDBOX=true`.** The banner disappears, email starts sending for
   real, and a live Stripe key stops being refused. Do this *last*.
3. **Set the real `LEGAL_*` values.** The Terms page warns while they are
   placeholders, and those placeholders appear verbatim in every executed
   agreement PDF.
4. **Move secrets to Key Vault**, referenced from Container Apps, rather than
   inline secrets.
5. **Back up `DB_PATH` and `CONTRACTS_DIR` together** — the contract hashes live
   in one and the files in the other, and separated they prove nothing.

And the four things that are not Azure's problem and not code: the market-data
licence, the lawyer's review, the pen test and E&O insurance. See
`docs/COSTS.md`.

---

## 9 · Troubleshooting

| Symptom | Cause |
| --- | --- |
| `az acr build` fails on `better-sqlite3` | The builder stage needs `python3 make g++`; the Dockerfile installs them. Check you built from the repo root. |
| App starts then exits | Read the logs. Usually `AUTH_SECRET` unset, or `DB_PATH` pointing somewhere unwritable. |
| Health returns 503 | `checks.database` is false — the `DB_PATH` directory does not exist or is not writable. |
| Login works, then logs you out | Two replicas. Confirm `--min-replicas 1 --max-replicas 1`. |
| Emails link to `localhost:3000` | `SITE_URL` not set to the real host. |
| Demo data vanished | Expected on ephemeral storage after a restart. Re-run the seed call in §2.8. |
