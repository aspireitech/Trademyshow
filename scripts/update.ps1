# Pull the latest code and rebuild — Windows.
#
# Run from the project folder:  .\scripts\update.ps1
#
# Stopping the server first is not optional: Node holds a lock on the native
# better-sqlite3 binary, and npm cannot replace it while the server is running.
# That is the EPERM failure.

$ErrorActionPreference = "Stop"
$branch = "claude/stock-analytics-ai-portal-j7ftsb"

Write-Host "==> Stopping any running server" -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "==> Pulling $branch" -ForegroundColor Cyan
git pull origin $branch

# Reinstalling every time is slow and pointless. Only do it when the lockfile
# actually moved.
$lockChanged = git diff --name-only HEAD@{1} HEAD 2>$null | Select-String "package-lock.json"
if ($lockChanged) {
  Write-Host "==> Dependencies changed, reinstalling" -ForegroundColor Cyan
  npm ci
} else {
  Write-Host "==> Dependencies unchanged, skipping npm ci" -ForegroundColor DarkGray
}

Write-Host "==> Building" -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "Done. Start the site with:  npm start" -ForegroundColor Green
Write-Host "Then open http://localhost:3000" -ForegroundColor Green
