#!/usr/bin/env bash
# Pull the latest code and rebuild — Linux / the Azure VM.
#
#   sudo ./scripts/update.sh
#
# Safe to re-run. If the build fails the old build is left in place and the
# running site is untouched, so a bad pull cannot take the site down.
set -euo pipefail

BRANCH="claude/stock-analytics-ai-portal-j7ftsb"
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

echo "==> Restarting $SERVICE"
systemctl restart "$SERVICE"
sleep 2
systemctl --no-pager --lines=5 status "$SERVICE" || true

echo
echo "Done."
