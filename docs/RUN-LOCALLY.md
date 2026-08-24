# Running it on your own computer

Works on Windows, Mac and Linux. About 10 minutes, most of it downloads.
Nothing here touches Azure, costs anything, or sends any email.

---

## 1 · Install two things

| | Download | Notes |
| --- | --- | --- |
| **Node.js 22 LTS** | [nodejs.org](https://nodejs.org) | Take the **LTS** button, not "Current". Node 23+ has no prebuilt database binary and tries to compile one, which fails on most Windows machines. |
| **Git** | [git-scm.com/downloads](https://git-scm.com/downloads) | Click through the installer. This is what downloads the code. |

Then open a terminal — **PowerShell** on Windows (press Start, type PowerShell),
**Terminal** on Mac (⌘+Space, type Terminal) — and check both installed:

```bash
node -v      # expect v22.something
git --version
```

If either says "not recognised", close the terminal, open a new one, and try
again — installers only affect terminals opened afterwards.

**Windows only, one-time:** PowerShell blocks npm by default. This allows it
for your user account only, and needs no administrator rights:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Answer `Y`. Without it every npm command fails with
*"running scripts is disabled on this system"*.

## 2 · Download the code

```bash
cd ~                 # your user folder — never install into C:\Windows\System32
git clone https://github.com/aspireitech/Trademyshow.git
cd Trademyshow
```

The folder you clone into matters: a project under `C:\Windows\System32`
needs administrator rights for ordinary file writes and will fail in
confusing ways.

## 3 · Create the settings file

One file, three lines. It tells the app to run in demo mode.

**Windows (PowerShell):**

```powershell
Set-Content -Path .env.local -Encoding ascii -Value @(
  "SANDBOX=true"
  "AUTH_SECRET=local-only-secret"
  "SITE_URL=http://localhost:3000"
)
```

Use `-Encoding ascii`, not `utf8`. Windows PowerShell writes a byte-order mark
with `utf8`, and that invisible character makes the first line of the file
unreadable — the setting looks present and is simply never applied.

**Mac or Linux:**

```bash
printf 'SANDBOX=true\nAUTH_SECRET=local-only-secret\nSITE_URL=http://localhost:3000\n' > .env.local
```

`.env.local` is ignored by git, so your settings never get committed.

## 4 · Build and start

```bash
npm ci        # downloads the libraries — 2-4 minutes, quiet while it works
npm run build # compiles the site — 1-2 minutes
npm run seed  # creates the demo accounts and a fortnight of insights
npm start     # starts the server
```

Then open **http://localhost:3000**.

| Account | Email | Password |
| --- | --- | --- |
| Demo user | `demo@trademyshow.com` | `Sandbox!Demo2026` |
| Admin | `admin@trademyshow.com` | `Sandbox!Admin2026` |

Press **Ctrl+C** in the terminal to stop it. To start it again later, just
`npm start` — the build and the seed do not need repeating.

---

## Everyday use

```bash
npm run dev        # development mode: edits appear instantly, no rebuild
npm test           # run the test suite
npm run verify     # typecheck + tests + build, all three
```

### Updating to the newest code

**One command does all of it:**

```powershell
.\scripts\update.ps1 -Start
```

It stops the server, fetches and checks out the right branch, reinstalls only
if the lockfile moved, rebuilds, refreshes the market cache, and starts the
site. Drop `-Start` if you would rather run `npm start` yourself.

Useful switches: `-NoRefresh` skips the price fetch when you are iterating on
layout and do not need newer prices; `-Branch <name>` takes a different branch.

**How often each part is actually needed:**

| Step | When |
| --- | --- |
| `git checkout <branch>` | Once. You stay on that branch until you switch. |
| `git pull` | Whenever there is new work to collect. |
| `npm ci` | Only when `package-lock.json` changed. The script decides for you. |
| `npm run build` | After any code change — `npm start` serves the last build, not your files. |
| `npm run refresh` | To get newer prices. The cache is on disk and survives restarts, so this is not needed just to restart. |
| `npm start` | Whenever you want the site running. |
| `npm run verify:prices` | When you want to confirm the prices are real. Not part of running. |

**For trying things out, use dev mode instead:**

```powershell
npm run dev
```

No build step, and edits appear in the browser as you save. It is slower per
page and shows development warnings, so use `npm run build` + `npm start` when
you want to see what a visitor would actually get — but for looking around,
`npm run dev` saves you a rebuild every time.

To pull a different branch: `.\scripts\update.ps1 -Branch some-other-branch`.

It can be run from the project folder or from inside `scripts\` — it finds the
project root itself. It resets the checkout to match the branch, so local edits
to tracked files are discarded; your `.env` and `data` folder are untracked and
are left alone.

**The very first time**, you need the new script before you can run it. Switch
branches by hand once:

```powershell
git fetch origin claude/landing-dashboard-stock-data-5fngt1
git checkout -B claude/landing-dashboard-stock-data-5fngt1 origin/claude/landing-dashboard-stock-data-5fngt1
```

After that, `.\scripts\update.ps1` handles it.

**Doing it by hand**, if you would rather see each step:

```powershell
# 1. Stop it: Ctrl+C in the window running the server. Then make sure:
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Get the code. `git pull` alone only updates the branch you are standing
#    on — which does nothing when the work landed on a different one.
git fetch origin claude/landing-dashboard-stock-data-5fngt1
git checkout -B claude/landing-dashboard-stock-data-5fngt1 origin/claude/landing-dashboard-stock-data-5fngt1

# 3. Only reinstall if the dependency list actually changed:
git diff HEAD@{1} --name-only | Select-String "package.json|package-lock.json"
#    …if that printed nothing, skip npm ci entirely.
npm ci

# 4. Rebuild — the old process must be gone, or port 3000 is taken and it
#    would serve the previous build anyway
npm run build

# 5. Fill the market cache with real prices. Nothing else does this, and
#    without it every screen correctly reports simulated data.
npm run refresh

# 6. Start, and check the prices are real
npm start
npm run verify:prices     # in a second terminal
```

Most pulls change no dependencies, so step 3 is usually skippable — which also
makes the update far faster.

**Why step 5 exists.** The site never calls a vendor while rendering a page; it
reads a local cache, and `npm run refresh` is what fills it. The first run also
pulls five years of daily closes, so it takes a minute or two; later runs take
seconds. Schedule it every few minutes during market hours (Task Scheduler on
Windows) or the prices go stale and the labels change to "End-of-day close".

**If prices still say "Simulated data"** after all that, the usual cause is one
line in your `.env`:

```
MARKET_DATA_PROVIDER=mock
```

That switches every vendor off. Delete the line — real data needs no setting
and no API key — then run `npm run refresh` again. `npm run verify:prices`
prints exactly which vendor failed and why, and the admin dashboard has the
same thing under **Market data**.

**If `npm ci` still fails with EPERM**, something is holding a file. Close your
editor, pause antivirus scanning of the folder, then:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `npm : command not found` | Node did not install, or the terminal predates the install. Open a new terminal. |
| `EADDRINUSE` / port 3000 in use | An earlier server is still running. `Get-Process node \| Stop-Process -Force`, then `npm start`. Restarting matters: the running process holds the *previous* build in memory and would keep serving old pages. To run both, use `npm start -- -p 3001`. |
| Build fails on `better-sqlite3` | Windows needs build tools: `npm install --global windows-build-tools`, or reinstall Node with "Tools for Native Modules" ticked. |
| Page loads but looks like plain text | A stale build. Delete the `.next` folder and run `npm run build` again. |
| Want to start over with fresh data | Delete the `data` folder, then `npm run seed`. |
| Prices look wrong, or say "Simulated data" | The cache is empty or `MARKET_DATA_PROVIDER=mock` is set in `.env`. Run `npm run verify:prices` — it names the vendor that failed and why. |
| Update ran but the site looks unchanged | A server was still running: it holds the previous build in memory and keeps serving it. `Get-Process node \| Stop-Process -Force`, then `npm start`. |

## What is different from the live version

Nothing, functionally — same code, same tests, same everything. What differs is
configuration: prices come from the deterministic mock rather than a market-data
vendor, email prints to the terminal instead of sending, and checkout runs in
stub mode. Those are the same settings the Azure sandbox uses, and each is a
single environment variable away from being real.
