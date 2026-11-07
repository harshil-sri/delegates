# Creative Veto Court

## Integrated courtroom

The illustrated Delegates frontend runs via a custom Node HTTP server:

```sh
node frontend/server.mjs
```

Open **http://127.0.0.1:4173/**. From the cinematic intro, **Enter Court** or
**Skip intro** opens `/court.html`, the read-only view of the backend case.
The server proxies `/api` to `127.0.0.1:18802`; set `CVC_COURT_PORT` if the clerk
uses another port. Starting the real clerk requires the Switch setup below.

Without the backend, the court can play a clearly labelled recorded rehearsal.
That mode is also available explicitly at `/court.html?replay=1`. A missing case
is an error, not a reason to show another case's recording. The previous scripted
weekend-build demo remains separately available at **`/?demo=1`**.

This is a **read-only frontend**: it displays the court but never sends decisions.
All approvals happen in the Switch/Mattermost room, from the bound human accounts.
The frontend cannot grant consent or send an approval through HTTP.

See [integration verification](docs/integration-verification.md) for startup,
test coverage and verification limits, and the [API contract](docs/frontend-api.md)
for the backend view model and event stream. `npm run build` produces static files
in `dist/`; a static host alone does not provide the API proxy.

The source includes functional regression tests and browser runners. Historical
screenshots in `design-review/final/` show an earlier design, not visual approval
of the integrated application.

## Existing backend

Two Codex-backed advocates and a deterministic clerk collaborate in one private
Switch room bridged to local Mattermost. A persistent clerk now enforces
human-owned mandates, amendments, and approvals of immutable storyboard bundles.
The read-only case page is **http://localhost:18802/**.

## Automatic storyboard negotiation

Once **both owners adopt their current briefs**, the background clerk runs the
workflow automatically:

1. The lead advocate produces a structured four-panel board through a real Codex turn.
2. The clerk stores that actual Switch source and runs deterministic checks.
3. The creator advocate reads that exact board and returns a review bound to its
   revision and full content hash.
4. If a brief change is needed, the clerk asks its owner and schedules no more
   model turns while the amendment is pending. Only that owner may accept or decline.
5. An accepted amendment triggers a revised lead proposal and another creator review.
6. Only a passing candidate recommended by the creator becomes a frozen preview
   for both humans to approve. The creator's recommendation grants no human approval.

The workflow allows at most two lead proposals per run and one schema repair per
turn. A declined amendment, exhausted round limit, provider failure, or interrupted
worker stops the run honestly. Either bound human may explicitly restart a stopped
run with the **NEGOTIATE** command displayed on the case page. Old or duplicate
agent replies cannot advance a different turn, board, or brief revision.

See [the automatic negotiation protocol](docs/automatic-negotiation.md) and
[the real background-worker rehearsal](docs/negotiation-live-result.json).
The rehearsal uses a separate private room and database, real Codex replies,
and explicitly synthetic mandate/amendment fixtures. It generates no human
approvals and leaves live C01 unchanged.

## Mandate and approval engine

The two human owners are separate native Mattermost accounts:

- **`court-owner`** owns the lead's H brief. Its existing password is
  `MATTERMOST_USER_PASSWORD` in ignored `.runtime/stack.env`.
- **`court-creator`** owns the creator's D brief. Its generated password is
  `MATTERMOST_CREATOR_PASSWORD` in ignored `.runtime/court-users.env`.

Only the bound owner may adopt or replace their brief, or accept/decline an
amendment to it. Either participant or advocate may request a change. Agents,
the clerk, copied display names, and platform messages on someone's behalf cannot
make a human decision.

Both humans must approve the **same current board revision and complete bundle
digest**. Brief changes and new boards invalidate earlier approval targets.
The prepared HTML, script, assets, brief hashes and renderer version are bound
into that digest. Official downloads serve the stored reviewed bytes, after
both approvals pass. An owner may revoke their own current approval.

Case C01 was initialized with unadopted H1/D1 and zero human approvals.
Setup does not send decisions through either human account. Automated positive
approval tests use synthetic identities and a separate test database.

See [the engine protocol and validation](docs/mandate-engine.md) and
[the live agent-authority rejection evidence](docs/court-engine-live-result.json).

## Verified behavior

The clerk posts a targeted request. The lead advocate reads the actual room
context through its own Switch credential, runs Codex CLI, and posts its result
under its own identity. The creator advocate reads the lead's stored message,
runs a separate Codex turn, and posts its objection/alternative. The clerk reads
both replies, checks the three distinct source identities, and independently
verifies that Mattermost received the messages.

See [the observed run](docs/spike-result.md),
[credential-free source references](docs/spike-result.json), and
[the live-worker verification](docs/live-listener-result.json). Reports are generated
only after a real successful run. The scenario is synthetic; no human consent
is simulated and no final storyboard is claimed.

## Requirements

- Node.js 22.13 or newer (tested on 26.7), PowerShell, and Docker Desktop with its Linux engine running.
- Codex CLI installed and `codex login status` reporting an existing sign-in.
- Network access for the first image pull and actual Codex calls.
- The default Windows Codex npm installation is detected. For another installation,
  set `CVC_CODEX_CLI` to its `codex.js` or native executable path.

The app has no npm dependencies. It uses your existing Codex login; provider
credentials are not copied into the project or sent to Switch. Advocate calls
use read-only mode, an ephemeral session, and a constrained reply schema.

## Start and verify

From this directory:

```powershell
.\scripts\start-stack.ps1
npm run setup
.\scripts\stop-workers.ps1
npm run setup:engine
npm test
.\scripts\start-workers.ps1
npm run status
```

`npm run check:listener` sends two new clerk prompts and verifies that both
background advocate workers answer automatically. It invokes the real provider
and is separate from the offline unit tests. `npm run check:clerk` verifies the
deterministic clerk's status reply without invoking a model.
`npm run check:engine` sends an agent-authored adoption command and verifies
its rejection through actual Switch source messages. It sends no human decisions.
The original scripted spike is still available as `npm run spike` with workers stopped.
`npm run check:negotiation` runs the real background negotiation in an isolated
verification room. It invokes Codex and clearly labels its synthetic owner inputs.

`start-stack.ps1` generates private random local credentials once and reuses them.
It starts the upstream standalone stack in Docker project `creative-veto-spike`.
Initial pulls can take several minutes. Startup details are in
`.runtime/stack-start.log`. An interrupted first startup can be retried with the
same script; do not regenerate credentials over existing database volumes.

`setup` is repeatable and preserves the three saved identities. It refuses to
overwrite a conflicting existing identity or room when its local credential
file is missing. The installed release must support message IDs in
`read_context`; incomplete room history fails explicitly.

## Open the room

- Mattermost channel: http://localhost:18865/creative-veto/channels/creative-veto-spike
- Switch dashboard: http://localhost:18801
- Agent bridge: http://localhost:18800
- Case page and read-only API: http://localhost:18802

For Mattermost, the local user is `court-owner`. Its password is the
`MATTERMOST_USER_PASSWORD` entry in ignored `.runtime/stack.env`. The dashboard
uses `GATEWAY_ADMIN_EMAIL` / `GATEWAY_ADMIN_PASSWORD` from that same private file.
Do not publish the file or paste it into a shared chat.

With workers running, send a **new** message in the channel:

```text
@cvc-lead-advocate Explain the portrait requirement and the decision the lead needs to make.
```

Then ask the other advocate to read the actual reply:

```text
@cvc-creator-advocate Read the lead's last proposal and suggest an object-based alternative that protects your boundary.
```

For the deterministic clerk, send `@cvc-clerk status C01`.

To complete the human workflow:

1. Open the case page and review both draft briefs. Each owner copies their own
   **ADOPT** command into the room from their own account.
2. The agents automatically propose and review BOARD1. Its portrait conflict
   produces an owner question. Only `court-owner` can accept the proposed H1
   replacement. Accepting creates H2 while preserving D1.
3. The lead automatically proposes BOARD2 and the creator reviews its exact
   content. A passing recommendation prepares the frozen preview.
4. Both owners inspect the preview and copy the same displayed **APPROVE** command
   into chat from their respective accounts. A single approval leaves export blocked.
5. When both approvals match, the page exposes the approved HTML, script and receipt.

Use separate browser profiles or a private window for the second account during
a local rehearsal. A posted decision takes effect when the clerk acknowledges it.
Editing or deleting an old post does not revoke the recorded decision; send a new
**REVOKE** command to withdraw your own current approval.

The identities are:

- `cvc-lead-advocate` — represents the creative lead's brief.
- `cvc-creator-advocate` — represents the collaborating creator's brief.
- `cvc-clerk` — deterministic room observer and spike coordinator.

These are **external/passive HTTP agents**, using separate identities and a local
Codex worker adapter. The Switch UI may report awaiting-manual-poll: the workers
poll rather than hold Console-managed sessions. `npm run status` reports the
local listener, and its logs are `.runtime/listener.out.log` and
`.runtime/listener.err.log`.

The listener answers new explicit mentions. Its saved seen-message IDs prevent
duplicate advocate turns after restarting. The case engine separately consumes
commands transactionally by room/source ID in SQLite, preserving decisions even
if delivery repeats. First start with an engine replays available room history;
commands from before case creation cannot adopt a new target.
It ignores the advocates' own messages to avoid an autonomous response loop.
Provider failures are recorded and not silently retried. The clerk observes
messages without impersonating a human or granting approvals. Advocate turns
pause while an amendment awaits its owner. Current persisted briefs and decisions
are passed into advocate turns; the original spike defaults cannot override them.
The room keeps polling while a model runs, so an owner edit can cancel an
in-flight turn. Built-in passive-agent notices never schedule another model.

To run in the foreground, use `npm run listen`. To stop this project's background
listener, run `.\scripts\stop-workers.ps1`. Stop the listener before running a
fresh scripted spike so two workers cannot answer the same prompt.

## Current scope

This increment implements owner adoption, amendment requests and decisions,
owner-only direct replacement, structured board ingestion, deterministic checks,
immutable HTML/script preparation, two-owner approvals, revocation and export.
Automatic structured proposals, exact-board creator reviews and bounded turn
scheduling are implemented. The page is a plain operational view. Briefs are
shared in the room, and both advocates use this machine's existing Codex login.
Private chambers, two-machine agent ownership, full court presentation and public
multi-tenant hosting remain future work. Manual PROPOSE commands cannot bypass
the creator review while automatic negotiation is enabled.

The room history is read completely: 500 entries per page (Switch's maximum),
paging backwards with `before` and merging by message ID, up to 10,000 entries.
Anything larger, or paging that does not advance, stops processing explicitly.
A failed poll, identity check, incomplete history or unavailable provider pauses
ingestion visibly (`/health` → `ingestion.state: "paused"`, with the reason and a
banner on the case page) and retries with backoff up to 30 seconds. It never
crashes the listener or skips a message. A clerk turn request that cannot be
confirmed within 90 seconds stops the run as `TURN_REQUEST_UNDELIVERED` instead
of waiting forever. Source timestamps use a
Switch server time reference to tolerate this machine's Docker/Windows clock
offset. The runtime is local and loopback-bound.

## Courtroom frontend API

`GET /api/cases/C01/court` returns one courtroom view model: phase, cast,
active speaker, pending human question, latest board and checks, signatures,
and the case as a list of courtroom beats (summons, proposal, objection,
appeal, decision, signature, verdict…). `GET /api/cases/C01/stream` pushes the
same data live as server-sent events and resumes with `Last-Event-ID`. CORS is
open only to local dev origins (`CVC_FRONTEND_ORIGINS` to change). The API stays
read-only: decisions happen only in the Switch room. See
[the frontend API](docs/frontend-api.md).

## Verify an approval receipt offline

After both owners approve, download the export, script and receipt from the
case page, then:

```powershell
npm run verify -- C01-receipt.json C01-BOARD2-storyboard.html C01-BOARD2-script.txt
```

The verifier needs no server. It recomputes the bundle digest, the file
hashes, each brief's hash and adoption, and the creator's exact-board review.
It checks that two distinct human owners approved that exact digest from their
own Switch messages, and re-runs the encoded rules. Changing one byte of the
storyboard, one approval or one brief term makes it fail.

## Files and runtime data

- `agents/` — role briefs and the provider response schema.
- `src/switch-client.mjs` — real Switch read/post adapter.
- `src/court-engine.mjs` — transactional case, ownership and approval rules.
- `src/court-http.mjs` — read-only case/preview/export server, courtroom view and SSE stream.
- `src/court-view.mjs` — frontend view model: phases and courtroom beats.
- `src/receipt-verify.mjs`, `scripts/verify-receipt.mjs` — offline approval-receipt verifier.
- `src/negotiation.mjs` — persisted turn scheduling, reviews, pauses and limits.
- `src/negotiation-worker.mjs`, `src/room-worker.mjs` — real Switch/Codex turns and continuous room ingestion.
- `src/storyboard.mjs`, `assets/` — deterministic renderer and original fixed assets.
- `src/codex-provider.mjs` — actual CLI invocation; there is no canned-model fallback.
- `scripts/` — setup, spike, listener, status, and stack controls.
- `infra/` — attributed, versioned upstream Compose file and license.
- `.runtime/` — ignored secrets, `court.sqlite` and its WAL, local state, provider logs, and detailed evidence.

Switch core/gateway/setup are pinned to **0.31.0**, bundled with official Console
release **0.40.1**. Mattermost is **11.9.0**. See `infra/NOTICE.md` for provenance.
No Switch-core source is patched. Keep `.runtime/` out of Git and any public archive.

## Local Docker startup repair on this machine

During setup Docker failed on an inaccessible zero-byte `dockerInference` socket.
The stale `C:\Users\iamda\AppData\Local\Docker\run` directory was renamed to
`run.before-creative-veto-20261107`, preserving it. Docker's backend was then
started without its desktop frontend. No volumes were pruned or reset; existing
containers were preserved. This repair is machine-specific and is not part of
the project's startup script.
