#!/usr/bin/env bash
# Pull the latest code, rebuild, refresh prices, restart — Linux / the Azure VM.
#
#   sudo ./scripts/update.sh
#   sudo BRANCH=some-branch ./scripts/update.sh
#
# Safe to re-run. If the build fails the old build is left in place and the
# running site is untouched, so a bad pull cannot take the site down.
#
# NOTE: this resets the checkout to match the branch exactly, so any local
# edits to tracked files are discarded. .env and the data folder are not
# tracked and are left alone.
set -euo pipefail

BRANCH="${BRANCH:-claude/landing-dashboard-stock-data-5fngt1}"
SERVICE="${SERVICE:-trademyshow}"

# Run from wherever it was invoked: the script lives in scripts/, so the
# project root is one level up. APP_DIR still wins when it is set, for an
# install that keeps the checkout somewhere else.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(dirname "$SCRIPT_DIR")}"

cd "$APP_DIR"
echo "==> Project folder: $APP_DIR"

if [ ! -f package.json ]; then
  echo "No package.json in $APP_DIR — is this the TradeMyShow folder?" >&2
  exit 1
fi

BEFORE="$(git rev-parse HEAD)"

echo "==> Fetching $BRANCH"
# Fetch then check out, rather than `git pull`: a pull only updates the branch
# you happen to be standing on, so it reports success and changes nothing when
# the work landed on a different branch.
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"
git reset --hard "origin/$BRANCH"

AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "==> Already up to date (${AFTER:0:7})"
else
  echo "==> Updated ${BEFORE:0:7} -> ${AFTER:0:7}"
fi

# Compare the two commits by SHA rather than using HEAD@{1}: the reflog entry
# does not always exist — a fresh clone, or a checkout that moved branches —
# and a missing one aborts the script under `set -e`.
if [ "$BEFORE" != "$AFTER" ] && git diff --name-only "$BEFORE" "$AFTER" | grep -q package-lock.json; then
  echo "==> Dependencies changed, reinstalling"
  npm ci
elif [ ! -d node_modules ]; then
  echo "==> No node_modules yet, installing"
  npm ci
else
  echo "==> Dependencies unchanged, skipping npm ci"
fi

echo "==> Building"
npm run build

# The one setting that silently keeps a working install on invented prices.
if grep -qsE '^[[:space:]]*MARKET_DATA_PROVIDER[[:space:]]*=[[:space:]]*mock' .env .env.local .env.production 2>/dev/null; then
  echo "!! MARKET_DATA_PROVIDER=mock is set in your .env"
  echo "   That switches every vendor off. Every price will be generated and"
  echo "   labelled 'Simulated data' on every screen."
  echo "   Remove that line — real prices need no setting and no API key —"
  echo "   then run this again."
else
  echo "==> Refreshing market data (the first run also pulls 5 years of history)"
  # Never fatal. A vendor being unreachable means simulated data with a label,
  # not a reason to abandon the deploy.
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
