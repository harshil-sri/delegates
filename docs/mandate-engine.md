# Mandates, amendments and exact storyboard approval

Implemented 7 November 2026. This is the local backend increment after the
Switch integration spike. The live case is intentionally left for the two
actual owners to adopt and approve. No account was used to fabricate consent.

**Automatic negotiation is now implemented.** See [its protocol and live
verification](automatic-negotiation.md). The human command rules below remain in
force. With automation enabled, manual PROPOSE cannot skip the scheduled creator
review, and a bound human may use NEGOTIATE to restart a stopped bounded run.

## Verified identity boundary

Trusted setup binds `court-owner` to the lead brief and `court-creator` to the
creator brief. They are distinct, active, non-bot Mattermost accounts in the
same private channel. Setup obtains each native account's opaque Switch sender
through a **read-only SQL query** against the pinned Switch 0.31.0 database.
The HTTP directory in this version omits the native-account-to-client mapping;
we do not synthesize it from a username. Queries are scoped to the room and
bridge, join tenant IDs, and read identity/membership metadata only. No core
table is written and no Switch source is patched.

Five different senders are frozen: two humans, two advocates and the clerk.
Setup refuses silent ownership replacement or a changed asset catalog.
The runtime rechecks native account status and channel membership before each
human command. Display names, `approved` fields in model output and statements
on someone else's behalf confer no authority. Agent and platform messages cannot
be counted as human decisions. Local operator access to the database or private
credentials is trusted; this increment is not a public deployment boundary.

The separate native accounts are ready for separate people to use. This does
not establish that two different people have signed in, that either has read a
preview, or that the advocates run on different machines.

## Room commands

Send one whole message beginning with `@cvc-clerk `, from the actual bound
account. Copy commands from http://localhost:18802/ so revisions and full
SHA-256 digests are exact. Quoted commands, code blocks and messages with extra
commentary do not make decisions. Decision messages cannot have attachments.

| Command after the clerk mention | Authority and effect |
|---|---|
| `ADOPT C01 H1 <brief digest>` | Lead owner adopts this exact current brief. D revisions belong to the creator. |
| `REQUEST C01 H1 <replacement JSON>` | A bound human or advocate proposes an immutable replacement; the brief is unchanged. |
| `ACCEPT C01 A1 <request digest>` | Only the affected owner adopts the exact requested replacement, creating the next brief revision. |
| `DECLINE C01 A1 <request digest>` | Only the affected owner declines; current terms stay in force. |
| `AMEND C01 H1 <replacement JSON>` | Only the affected owner directly replaces the current brief and adopts the new version. |
| `PROPOSE C01 <storyboard JSON>` | Manual mode only. Automatic mode requires its scheduled lead proposal followed by creator review. Board revisions are allocated by the server. |
| `NEGOTIATE C01` | A bound human explicitly restarts a stopped automatic run, limited to two lead proposals. |
| `APPROVE C01 BOARD2 <bundle digest>` | One bound human approves that exact current prepared bundle. Both owners must independently send the same target. |
| `REVOKE C01 BOARD2 <bundle digest>` | A human withdraws only their own current approval. |
| `status C01` | Clerk reports the persisted stage. |

H1, H2 and subsequent H revisions always belong to the lead. D revisions always
belong to the creator. Brief ownership cannot be changed through a JSON payload.
The response schema accepts only goal, required/forbidden assets, required copy,
final copy and negotiable terms. Changes to these fields are whole, reviewable
replacements rather than text patches interpreted by a model.

An `ACCEPT` or `AMEND` creates a new immutable brief version. It supersedes other
pending amendments against that owner's old version, marks boards stale and
removes the current approval target. The other owner's brief is unchanged.
Pending amendment requests pause new board submissions, approvals and advocate
turns until the affected owner decides. A decline can resume review of an
unchanged existing bundle.

## Board and approval binding

Both owners must adopt their briefs before a board is accepted. Each structured
board names the exact current H/D references. The deterministic checker enforces:

- Four panels, positive whole-second durations, and a 30-second total.
- Known, permitted asset IDs. The portrait has metadata only and cannot render.
- Each owner's required and forbidden asset selections.
- Exact on-screen copy lines, including required copy in the final panel.

A board that fails rules remains in history, has no approvable bundle, and
supersedes the earlier approval target. A successful board is rendered once into
an HTML storyboard and text script with application-owned SVG assets. Text is
escaped; model-provided HTML, paths, URLs and executable rendering code are not
accepted as assets.

The canonical bundle manifest binds case ID, never-reused board revision,
preparation timestamp, full structured board, current brief references and
hashes, the immutable asset catalog and selected asset byte hashes, renderer
version, and the exact HTML/script file hashes. Its full SHA-256 digest is part
of both humans' approval commands. The prepared bytes live in SQLite with the
manifest; an export never rerenders the board. The text script and manifest are
also available to review before approval.

An approval checks the trusted room, complete source ID, bound direct human
sender, exact whole-message command, current board and digest, current adopted
briefs, absence of pending human questions, successful checks, preparation time,
and stored-byte integrity. One owner's repeated approval does not become two.
Any new board revision or accepted/direct brief amendment invalidates previous
approvals for current export, even if the creative text happens to be identical.
Historical approvals and previews remain inspectable. Revocation preserves the
original approval and its withdrawal source.

The official receipt contains the bundle manifest, adopted briefs, accepted
amendments, proposal source, checks and both human approval source references.
Editing/deleting a chat post is not a revocation protocol; send a fresh REVOKE
command. Stored decisions preserve the original observed source payload.

## Persistence and operational behavior

`.runtime/court.sqlite` contains case snapshots, immutable bundles, source inbox,
audit events and notification outbox. `BEGIN IMMEDIATE` transactions commit a
decision, consumed-source record, artifact and reply intent together. Duplicate
room/source IDs return the existing result without applying a second action.
Changed content under a consumed source ID cannot replay a command.

Rejected commands produce an audit entry without partial state changes. A
renderer/storage failure rolls the action back. Notifications have deterministic
event markers. A send with an unknown result is reconciled against actual clerk
history before it is marked delivered; it is not blindly resent. Unreconciled
notifications remain visible in `/health` and the local log.

Switch and the Windows host need not have identical clocks. Setup and startup
anchor the engine to the configured loopback Switch HTTP server's Date and
monotonic elapsed time. A missing server time fails startup. Source freshness
checks therefore use the same clock domain as the room, rather than assuming
Docker and Windows wall clocks agree. The live test caught a roughly 24-second
offset on this machine, which is handled by this reference.

The room poll reads complete history in 500-entry pages (see the README).
Truncation is never treated as complete. A network, Switch, Mattermost or
account-verification failure pauses ingestion before consuming the decision;
the worker retries with backoff and resumes by itself once the cause clears.
`/health` reports the paused state and reason. Decisions take effect when the clerk records them;
the read-only view can lag messages still in transit or waiting for a poll.

## Read-only HTTP interface

The service binds `127.0.0.1:18802`, checks the Host header, exposes no mutation
endpoint and sends no browser credentials. The plain case page refreshes every
10 seconds. The courtroom frontend reads `/api/cases/C01/court` and the live
`/api/cases/C01/stream` (server-sent events); see [the frontend API](frontend-api.md).

| Route | Result |
|---|---|
| `/health` | Service mode, case stages and unsent notification count. |
| `/api/cases/C01` | Case snapshot and exact review commands. |
| `/api/cases/C01/events?after=0` | Persisted events, up to 500 per page. |
| `/api/cases/C01/boards/2/preview` | Stored HTML review bytes. |
| `/api/cases/C01/boards/2/script-preview` | Stored text review bytes. |
| `/api/cases/C01/boards/2/manifest` | Complete bound manifest and bundle digest. |
| `/api/cases/C01/boards/2/export` | The same HTML bytes, gated by two current approvals. |
| `/api/cases/C01/boards/2/script` | Approved text download. |
| `/api/cases/C01/boards/2/receipt` | Current official approval receipt. |

Historical previews may be copied by their viewers; the official export gate
labels and serves approved work and does not attempt to provide content DRM.

## Validation and current live state

Run `npm test` for ownership, amendment, stale revision, exact bundle, duplicate
delivery, restart, revocation, rendering, HTTP authorization, account validation
and uncertain-notification checks. The positive human decisions in these tests
are synthetic fixtures in memory or a temporary SQLite database. They never
reach the actual room.

`npm run check:engine` uses the clerk's real agent credential to attempt an ADOPT
command. The live worker must reject it as HUMAN_REQUIRED, and the script reads
the source and rejection back from Switch. See
[the recorded live result](court-engine-live-result.json). It verifies no brief
or approval changed and records the current live stage. `npm run check:clerk`
separately proves a deterministic status reply from the real clerk identity.

The live C01 remains available for real owners to make their own decisions.
The Codex advocates use persisted current mandates. Automatic schema-constrained
storyboard turns and the bounded negotiation scheduler are now implemented;
see [the automatic workflow](automatic-negotiation.md).
