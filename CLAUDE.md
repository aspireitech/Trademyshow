# TradeMyShow — read this first

**Every session: read `docs/STATE.md` before doing anything else.** It is the single
source of truth for what is built, what is left, and what decisions are already
settled. Do not re-derive project history from the conversation — the state file
exists so a cold session costs nothing.

**Every session: update `docs/STATE.md` before you finish.** Move finished items
into "Done", add anything new to "Next up", and record any decision that would
otherwise have to be re-argued. A session that changed code without updating the
state file has left the next session to pay for it again.

## Project

Stock-insight SaaS. Next.js 15 App Router, TypeScript strict, React 19, SQLite via
better-sqlite3 (needs Node 22 — there is no Node 24 prebuild).

## Working agreements

- Branch: `claude/stock-analytics-ai-portal-j7ftsb`. Also push `main`.
- **Always commit and push before the session ends.** The owner has asked for
  GitHub to be current at all times, and this sandbox is discarded when the
  session closes — anything unpushed is lost, not merely delayed. Push even for
  work in progress; an honest commit message beats a lost afternoon.
- Run `npx vitest run` and `npx next build` before pushing. Both must be clean.
- Market data is simulated and must always be labelled as such in the UI.
- Never write copy that promises, forecasts or guarantees a price move. The legal
  position is that the product narrates arithmetic the AI cannot alter. See
  `docs/STATE.md` → "Settled decisions".
- Light theme is the default. Dark is opt-in via `:root[data-theme="dark"]`.

## Commands

```
npm run dev            # local dev
npx vitest run         # unit suite
npx next build         # production build
npx playwright test    # e2e (needs a built app on :3000)
npm run seed           # seed the SQLite database
```

## Deploying an update to a running machine

```
.\scripts\update.ps1   # Windows: stop server, pull, rebuild
sudo ./scripts/update.sh # Linux/Azure VM: pull, rebuild, restart the service
```
