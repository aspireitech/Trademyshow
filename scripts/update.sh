#!/usr/bin/env bash
# Pull the latest code and rebuild — Linux / the Azure VM.
#
#   sudo ./scripts/update.sh
#
# Safe to re-run. If the build fails the old build is left in place and the
# running site is untouched, so a bad pull cannot take the site down.
set -euo pipefail

BRANCH="${BRANCH:-claude/landing-dashboard-stock-data-5fngt1}"
APP_DIR="${APP_DIR:-/opt/trademyshow}"
SERVICE="${SERVICE:-trademyshow}"

cd "$APP_DIR"

echo "==> Pulling $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q package-lock.json; then
  echo "==> Dependencies changed, reinstalling"
  npm ci
else
  echo "==> Dependencies unchanged, skipping npm ci"
fi

echo "==> Building"
npm run build

# The one setting that silently keeps a working install on invented prices.
if grep -qsE '^[[:space:]]*MARKET_DATA_PROVIDER[[:space:]]*=[[:space:]]*mock' .env .env.local .env.production 2>/dev/null; then
  echo "!! MARKET_DATA_PROVIDER=mock is set in your .env"
  echo "   Every price will be generated and labelled 'Simulated data'."
  echo "   Remove that line to get real prices, then re-run this."
else
  echo "==> Refreshing market data (first run also pulls 5 years of history)"
  # Never fatal. A vendor being unreachable is a reason to show simulated data
  # with a label, not a reason to abandon the deploy.
  npm run refresh || {
    echo "   Refresh failed — the site will run on simulated data and say so."
    echo "   Diagnose with: npm run verify:prices"
  }
fi

echo "==> Restarting $SERVICE"
systemctl restart "$SERVICE"
sleep 2
systemctl --no-pager --lines=5 status "$SERVICE" || true

echo
echo "Done."
echo "Check the prices are real:  npm run verify:prices"
