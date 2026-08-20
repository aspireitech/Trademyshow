# Running it on your own computer

Works on Windows, Mac and Linux. About 10 minutes, most of it downloads.
Nothing here touches Azure, costs anything, or sends any email.

---

## 1 · Install two things

| | Download | Notes |
| --- | --- | --- |
| **Node.js 22 LTS** | [nodejs.org](https://nodejs.org) | Take the LTS installer and click through. This is what runs the app. |
| **Git** | [git-scm.com/downloads](https://git-scm.com/downloads) | Click through the installer. This is what downloads the code. |

Then open a terminal — **PowerShell** on Windows (press Start, type PowerShell),
**Terminal** on Mac (⌘+Space, type Terminal) — and check both installed:

```bash
node -v      # expect v22.something
git --version
```

If either says "not recognised", close the terminal, open a new one, and try
again — installers only affect terminals opened afterwards.

## 2 · Download the code

```bash
git clone https://github.com/aspireitech/Trademyshow.git
cd Trademyshow
```

## 3 · Create the settings file

One file, three lines. It tells the app to run in demo mode.

**Windows (PowerShell):**

```powershell
"SANDBOX=true`nAUTH_SECRET=local-only-secret`nSITE_URL=http://localhost:3000" | Out-File -Encoding utf8 .env.local
```

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
git pull           # get the newest code, then: npm ci && npm run build
```

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `npm : command not found` | Node did not install, or the terminal predates the install. Open a new terminal. |
| `EADDRINUSE` / port 3000 in use | Something else is on that port. `npm start -- -p 3001` and use `localhost:3001`. |
| Build fails on `better-sqlite3` | Windows needs build tools: `npm install --global windows-build-tools`, or reinstall Node with "Tools for Native Modules" ticked. |
| Page loads but looks like plain text | A stale build. Delete the `.next` folder and run `npm run build` again. |
| Want to start over with fresh data | Delete the `data` folder, then `npm run seed`. |

## What is different from the live version

Nothing, functionally — same code, same tests, same everything. What differs is
configuration: prices come from the deterministic mock rather than a market-data
vendor, email prints to the terminal instead of sending, and checkout runs in
stub mode. Those are the same settings the Azure sandbox uses, and each is a
single environment variable away from being real.
