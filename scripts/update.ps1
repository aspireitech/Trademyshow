# Pull the latest code, rebuild, and refresh the market cache — Windows.
#
#   .\scripts\update.ps1                     from the project folder
#   .\update.ps1                             from inside scripts\ — also fine
#   .\scripts\update.ps1 -Branch some-branch to take a different branch
#
# NOTE: this resets the checkout to match the branch exactly, so any local
# edits to tracked files are discarded. Your .env and data folder are not
# tracked and are left alone.
#
# Stopping the server first is not optional: Node holds a lock on the native
# better-sqlite3 binary, and npm cannot replace it while the server is running.
# That is the EPERM failure. It also holds the *previous* build in memory, so a
# server left running keeps serving the old pages after a successful rebuild —
# which looks exactly like an update that did not work.

param(
  [string]$Branch = "claude/landing-dashboard-stock-data-5fngt1",
  # Start the server when the update finishes, instead of leaving you to type
  # `npm start` as a separate step. Off by default: on a deployed machine the
  # service manager owns starting the server, not this script.
  [switch]$Start,
  # Skip the market refresh — for when you are iterating on layout and do not
  # need newer prices. The cache already on disk keeps serving.
  [switch]$NoRefresh
)

# Deliberately NOT "Stop". git writes ordinary progress to stderr, and with
# ErrorActionPreference=Stop PowerShell turns that into a NativeCommandError
# and aborts a script that is working perfectly. Every step that matters checks
# $LASTEXITCODE instead, which is the only reliable signal a native command
# gives on Windows PowerShell.
$ErrorActionPreference = "Continue"

function Fail($message) {
  Write-Host ""
  Write-Host $message -ForegroundColor Red
  exit 1
}

# Run from wherever it was invoked. The script lives in scripts\, so the
# project root is one level up — being in the wrong directory is otherwise a
# confusing failure three commands later, when npm cannot find package.json.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "==> Project folder: $root" -ForegroundColor DarkGray

if (-not (Test-Path "package.json")) {
  Fail "No package.json in $root — is this the TradeMyShow folder?"
}

Write-Host "==> Stopping any running server" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$before = (git rev-parse HEAD)
if ($LASTEXITCODE -ne 0) { Fail "Not a git repository." }

Write-Host "==> Fetching $Branch" -ForegroundColor Cyan
# Fetch then check out, rather than `git pull`: a pull only updates the branch
# you happen to be standing on, so it reports success and changes nothing when
# the work landed on a different branch.
git fetch origin $Branch
if ($LASTEXITCODE -ne 0) { Fail "Could not fetch $Branch. Check the branch name and your network." }

git checkout -B $Branch "origin/$Branch"
if ($LASTEXITCODE -ne 0) { Fail "Could not check out $Branch." }

git reset --hard "origin/$Branch"
if ($LASTEXITCODE -ne 0) { Fail "Could not reset to origin/$Branch." }

$after = (git rev-parse HEAD)

if ($before -eq $after) {
  Write-Host "==> Already up to date ($($after.Substring(0,7)))" -ForegroundColor DarkGray
} else {
  Write-Host "==> Updated $($before.Substring(0,7)) -> $($after.Substring(0,7))" -ForegroundColor Cyan
}

# Reinstalling every time is slow and pointless. Compare the two commits by SHA
# rather than using HEAD@{1}: the reflog entry does not always exist, and in
# PowerShell an unquoted HEAD@{1} is parsed as a hashtable literal, which is
# what produced "fatal: ambiguous argument 'HEAD@'".
$lockChanged = $false
if ($before -ne $after) {
  $changedFiles = git diff --name-only $before $after
  $lockChanged = @($changedFiles | Where-Object { $_ -like "*package-lock.json" }).Count -gt 0
}

if ($lockChanged) {
  Write-Host "==> Dependencies changed, reinstalling" -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) {
    Fail "npm ci failed. If it says EPERM, something still has a file open: close your editor, pause antivirus on this folder, and try again."
  }
} else {
  Write-Host "==> Dependencies unchanged, skipping npm ci" -ForegroundColor DarkGray
}

if (-not (Test-Path "node_modules")) {
  Write-Host "==> No node_modules yet, installing" -ForegroundColor Cyan
  npm ci
  if ($LASTEXITCODE -ne 0) { Fail "npm ci failed." }
}

Write-Host "==> Building" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
  Fail "Build failed. The previous build is untouched, so the site still runs on the old version."
}

# The one setting that silently keeps a working install on invented prices.
$envFiles = @(".env.local", ".env.production", ".env") | Where-Object { Test-Path $_ }
$mockPin = @($envFiles | ForEach-Object {
  Select-String -Path $_ -Pattern '^\s*MARKET_DATA_PROVIDER\s*=\s*mock' -ErrorAction SilentlyContinue
})

if ($mockPin.Count -gt 0) {
  Write-Host ""
  Write-Host "!! MARKET_DATA_PROVIDER=mock is set in: $($mockPin[0].Path)" -ForegroundColor Yellow
  Write-Host "   That switches every vendor off. Every price will be generated" -ForegroundColor Yellow
  Write-Host "   and labelled 'Simulated data' on every screen." -ForegroundColor Yellow
  Write-Host "   Delete that line — real prices need no setting and no API key —" -ForegroundColor Yellow
  Write-Host "   then run this script again." -ForegroundColor Yellow
  Write-Host ""
} elseif ($NoRefresh) {
  Write-Host "==> Skipping the market refresh (-NoRefresh); prices stay as cached" -ForegroundColor DarkGray
} else {
  Write-Host "==> Refreshing market data (the first run also pulls 5 years of history)" -ForegroundColor Cyan
  npm run refresh
  if ($LASTEXITCODE -ne 0) {
    # Never fatal. A vendor being unreachable means simulated data with a
    # label, not a reason to leave the site un-deployed.
    Write-Host "   Refresh failed — the site will run on simulated data and say so." -ForegroundColor Yellow
    Write-Host "   Diagnose with: npm run verify:prices" -ForegroundColor Yellow
  }
}

Write-Host ""
if ($Start) {
  Write-Host "==> Starting on http://localhost:3000  (Ctrl+C to stop)" -ForegroundColor Green
  Write-Host ""
  npm start
} else {
  Write-Host "Done. Start the site with:  npm start" -ForegroundColor Green
  Write-Host "  ...or next time:          .\scripts\update.ps1 -Start" -ForegroundColor DarkGray
  Write-Host "Then open http://localhost:3000" -ForegroundColor Green
  Write-Host ""
  Write-Host "Check the prices are real:  npm run verify:prices" -ForegroundColor Green
}
