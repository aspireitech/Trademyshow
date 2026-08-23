# Pull the latest code, rebuild, and refresh the market cache — Windows.
#
# Run from the project folder:  .\scripts\update.ps1
# A different branch:           .\scripts\update.ps1 -Branch my-branch
#
# Stopping the server first is not optional: Node holds a lock on the native
# better-sqlite3 binary, and npm cannot replace it while the server is running.
# That is the EPERM failure. It also holds the *previous* build in memory, so a
# server left running keeps serving the old pages after a successful rebuild —
# which looks exactly like an update that did not work.

param(
  [string]$Branch = "claude/landing-dashboard-stock-data-5fngt1"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Stopping any running server" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "==> Fetching $Branch" -ForegroundColor Cyan
# Fetch then checkout, rather than `git pull`: a plain pull only updates the
# branch you happen to be standing on, which silently does nothing when the
# work landed somewhere else.
git fetch origin $Branch
git checkout -B $Branch "origin/$Branch"
git reset --hard "origin/$Branch"

# Reinstalling every time is slow and pointless. Only do it when the lockfile
# actually moved.
$lockChanged = git diff --name-only "HEAD@{1}" HEAD 2>$null | Select-String "package-lock.json"
if ($lockChanged) {
  Write-Host "==> Dependencies changed, reinstalling" -ForegroundColor Cyan
  npm ci
} else {
  Write-Host "==> Dependencies unchanged, skipping npm ci" -ForegroundColor DarkGray
}

Write-Host "==> Building" -ForegroundColor Cyan
npm run build

# $ErrorActionPreference does not apply to native commands on Windows
# PowerShell 5.1 — a failed build sets $LASTEXITCODE and carries on. Checking
# it explicitly is what stops the script printing "Done" over a broken build.
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. The previous build is untouched, so the site still runs." -ForegroundColor Red
  exit 1
}

# The one setting that silently keeps a working install on invented prices.
$envFiles = @(".env.local", ".env.production", ".env") | Where-Object { Test-Path $_ }
$mockPin = $envFiles | ForEach-Object { Select-String -Path $_ -Pattern '^\s*MARKET_DATA_PROVIDER\s*=\s*mock' -ErrorAction SilentlyContinue }
if ($mockPin) {
  Write-Host ""
  Write-Host "!! MARKET_DATA_PROVIDER=mock is set in your .env" -ForegroundColor Yellow
  Write-Host "   Every price will be generated and labelled 'Simulated data'." -ForegroundColor Yellow
  Write-Host "   Delete or comment out that line to get real prices, then re-run this." -ForegroundColor Yellow
  Write-Host ""
} else {
  Write-Host "==> Refreshing market data (first run also pulls 5 years of history)" -ForegroundColor Cyan
  # Never fatal. A vendor being unreachable is a reason to show simulated data
  # with a label, not a reason to leave the site un-deployed.
  npm run refresh
  if ($LASTEXITCODE -ne 0) {
    Write-Host "   Refresh failed — the site will run on simulated data and say so." -ForegroundColor Yellow
    Write-Host "   Diagnose with: npm run verify:prices" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Done. Start the site with:  npm start" -ForegroundColor Green
Write-Host "Then open http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Check the prices are real:  npm run verify:prices" -ForegroundColor Green
