# TradeMyShow — read this first

**Read `docs/STATE.md`, then start work.** It carries the file map, the settled
decisions, the traps, and a "to change X, open Y" table. It is written so that
two or three targeted file reads are enough to begin — no survey of the
codebase, no re-deriving history from the conversation.

**Update `docs/STATE.md` before you finish.** Tick off what is done, add what is
new, record any decision that would otherwise be re-argued, and add any trap
that cost you time. A session that changed code without updating it has left the
next session to pay the same cost again.

## Reading budget — this is a real constraint

Context is the owner's money. Spend it on the work, not on rediscovering the
project.

- **Start from the map in STATE.md.** Open the files it names. Do not survey
  directories, and do not grep broadly to find where something lives — that is
  what the map is for. If the map is wrong or missing an entry, fix the map.
- **Read parts of files, not whole files.** `marketdata.ts` is ~600 lines and
  `globals.css` ~2000; grep for the symbol or class first, then read around the
  hit. Whole-file reads are for files under ~150 lines.
- **Never re-read a file you just edited** to confirm the edit landed. The tool
  errors if it does not.
- **`docs/HISTORY.md` is not read by default.** Nor are `DEPLOY.md`,
  `OPERATIONS.md`, `RUN-LOCALLY.md`, `DESIGN.md`, `COSTS.md`, `ROADMAP.md`.
  Open one only when its subject is the task.
- **Do not spawn subagents** unless the owner asks. Each one starts cold and
  re-derives the context this file exists to give you for free.
- Prefer one wide command over several narrow ones — batch related greps and
  reads into a single call.

## Project

Stock-insight SaaS. Next.js 15 App Router, TypeScript strict, React 19, SQLite
via better-sqlite3 (needs Node 22 — there is no Node 24 prebuild).

## Working agreements

- Branch: `claude/landing-dashboard-stock-data-5fngt1`.
- **Always commit and push before the session ends.** The owner wants GitHub
  current at all times, and this sandbox is discarded when the session closes —
  anything unpushed is lost, not merely delayed. Push work in progress too; an
  honest commit message beats a lost afternoon.
- Run `npx vitest run` and `npx next build` before pushing. Both must be clean.
- Market data is real by default (Yahoo, then Stooq, then Finnhub if keyed) and
  read from the local cache, never straight from a vendor. Where no real quote
  exists the simulation answers — and every screen showing it must say so.
  `sourceFor()` in `src/lib/providers/feed.ts` is the only thing that decides
  which label a number gets; never print a price without one.
- Never write copy that promises, forecasts or guarantees a price move. The
  legal position is that the product narrates arithmetic the AI cannot alter.
- Light theme is the default. Dark is opt-in via `:root[data-theme="dark"]`.
- Check any layout change at phone width. Every page currently has zero
  horizontal overflow and that is a property worth keeping.

## Commands

```
npm run dev            # local dev
npx vitest run         # unit suite
npx next build         # production build
npx playwright test    # e2e (needs a built app)
npm run seed           # seed the SQLite database
npm run refresh        # fill the price cache from the live feed
npm run verify:prices  # are the prices real? vendor vs. what we show
```

## Deploying an update to a running machine

```
.\scripts\update.ps1     # Windows: stop server, fetch branch, rebuild, refresh
sudo ./scripts/update.sh # Linux/Azure VM: same, then restart the service
```

Both take the branch as a parameter and default to the one above. They fetch and
check out rather than `git pull`, because a pull only moves the branch you are
standing on. Afterwards, `npm run verify:prices` says whether the prices on the
site are real.
