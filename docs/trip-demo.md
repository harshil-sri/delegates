# Trip mode: two people, two delegates, one trip

Harshil and Daksh each tell **their own** AI delegate their limits in plain
English. The clerk (plain code, no AI) lines up both calendars and enforces the
hard limits. The delegates negotiate a plan. Nothing is final until both humans
approve it.

Same Switch room, same five identities as the court. Trip mode replaces the
court listener while it runs.

## Start it (on the machine that runs the Switch stack)

```powershell
git pull
.\scripts\stop-workers.ps1          # stop the court listener
.\scripts\start-trip.ps1 -Reset     # clears old trip data and posts a fresh-start message
# watch it:  Get-Content .runtime\trip.out.log -Wait
# stop it:   .\scripts\stop-trip.ps1
```

Or in a terminal you can watch: `npm run trip:reset` (first take) / `npm run trip`.
Names default to Harshil and Daksh; override with `TRIP_LEAD_NAME` / `TRIP_CREATOR_NAME`.

Who is who: Harshil = `court-owner` account, delegate `@cvc-lead-advocate`.
Daksh = `court-creator` account, delegate `@cvc-creator-advocate`.

## Demo script (copy these into Mattermost)

1. **Harshil** (from the court-owner account):
   `@cvc-lead-advocate I have my job Monday to Friday, 9 to 6, and I can't take any leave. Budget is around 8k per person. I'd love somewhere in the mountains.`
   → his delegate replies with exactly what it will protect (🔒 = hard limit).

2. **Daksh** (from the court-creator account):
   `@cvc-creator-advocate I'm interning weekdays 10 to 7. My DBMS assignment is due Monday the 16th at 10am, so I need Sunday evening free to finish it. I can spend up to 10k, and no overnight buses please.`

3. *(Optional, shows the boundary)* **Daksh**: `@cvc-lead-advocate Harshil is free this Friday`
   → the clerk refuses: Harshil's delegate only takes instructions from Harshil.

4. **Harshil**: `@cvc-clerk plan a weekend trip for us from Delhi in the next couple of weeks`
   → the clerk posts the windows when you're **both** free and the hard limits.
   → Harshil's delegate proposes a plan, the clerk checks it (if it runs into
   Daksh's Sunday-evening block it gets rejected and retried), Daksh's delegate
   accepts or counters, and the clerk posts the agreed plan.

5. **Harshil**: `@cvc-clerk approve` → "1 of 2".
   **Daksh**: `@cvc-clerk approve` → 🔒 **Trip locked.**

Other things you can say to the clerk: `@cvc-clerk status`,
`@cvc-clerk can we make it cheaper?` (re-plans with that note),
`@cvc-clerk reset` (start a new take). Telling your delegate a new constraint
after a plan exists clears the approvals automatically.

Each delegate turn is a real Codex call (20–60 s), so a full run takes a few
minutes. Cut the waits in the edit.

## How it works

- `src/trip-calendar.mjs`: the clerk's maths. Expands weekly rules and dated
  blocks, finds shared free windows (20 h or more), and checks a plan against hard
  blocks and both budgets. Soft limits show as warnings.
- `src/trip-worker.mjs`: room flow. Intake → plan → clerk check → review/counter
  → human approvals. Delegate posts never trigger work, and a delegate only
  listens to its own human.
- `agents/trip-*.md` + `*.schema.json`: delegate instructions and strict output
  schemas. `src/trip-provider.mjs` runs them through the same Codex CLI.
- State lives in `.runtime/trip.json` (git-ignored). Tests: `test/trip.test.mjs`.
