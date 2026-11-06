# Automatic storyboard negotiation

Implemented 7 November 2026. Two real Codex workers negotiate through their
separate Switch identities. The deterministic clerk owns the state machine;
neither model can adopt a brief, accept an amendment, or approve for a human.

## Normal SIGNAL flow

1. Each native human owner adopts their exact brief from the case page. No model
   is scheduled before both current mandates are adopted.
2. The clerk schedules one lead proposal. The lead reads the actual clerk
   request through its own Switch credential and returns a strict JSON board.
   The initial H1 portrait requirement remains a real constraint, so the first
   candidate conflicts with D1 and the permitted asset catalog.
3. The creator reads the actual lead source and the stored board/checks. Its
   strict JSON review names both the exact BOARD revision and board SHA-256.
4. The creator requests an H1 amendment permitting an object-based alternative.
   The clerk stores the whole replacement and posts the owner question. Nothing
   in the brief changes yet. No further model runs while the request is pending.
5. Only the lead's bound human can ACCEPT or DECLINE. Acceptance creates H2,
   preserves D1 and schedules a new lead proposal against H2/D1. Decline keeps H1
   and stops the incompatible run; no consent or softer interpretation is inferred.
6. The creator reviews BOARD2. A `recommend` result can prepare a preview only if
   every encoded rule passes. Its exact review/source is included in the frozen
   bundle manifest and eventual receipt.
7. Both humans inspect the prepared preview and send the same exact APPROVE
   target. The models stop at preparation; zero, one, and two human approvals
   remain distinct states. Export remains blocked until both approve.

The read-only page shows the active phase, turn history, candidate panels,
checks, owner question, and final review commands. No manual PROPOSE message can
bypass the scheduled creator review when automation is enabled.

## Turn identity and persistence

Each persisted turn has an unpredictable ID, run number, expected advocate,
phase, current brief references/hashes and catalog hash. A review turn also binds
the candidate revision and content hash. The clerk's request is an outbox event;
the worker cannot start until it has a confirmed Switch source ID. The worker
verifies that source belongs to the bound clerk before invoking Codex.

The lead uses `agents/lead-board.schema.json`; the creator uses
`agents/creator-review.schema.json`. Both use the existing read-only ephemeral
Codex CLI adapter. Tools are forbidden; malformed output or a tool invocation
cannot silently become a final board. Each worker has its own Switch credential
and posts under that advocate's actual source identity.

The worker publishes a whole room envelope:

```text
CVC_TURN C01 T<32 hex characters> <phase-specific JSON>
```

The envelope deliberately makes no direct mention of the passive clerk. Switch's
built-in manual-poll responder therefore does not turn a result into another
session request. Human decisions continue to use `@cvc-clerk ...`. The former
`@cvc-clerk TURN ...` form remains parseable for compatibility; it confers no
additional authority.

Only the room listener consuming the actual Switch message can apply the
result. A local model completion and a successful post do not themselves commit
a board or review. Sender, current turn, phase, brief bindings, source freshness,
review hash and schema all have to match. A human cannot impersonate a scheduled
agent by copying the envelope, and a stale agent cannot answer a later turn.

Board/review state, consumed source, audit events and subsequent clerk request
commit in one SQLite transaction. Duplicate source IDs apply once. Candidate
revisions are never reused. Previews are deferred until the creator recommends
the exact passing candidate; prior manual previews without creator review become
historical when automatic mode is enabled.

## Bounded progress and failures

- At most two accepted lead proposals per run. Their reviews may recommend,
  request a revision, request an owner amendment, or stop with a blocking reason.
- One schema repair per turn. A repaired turn gets a new ID and preserves the
  same role, phase and review target. The second invalid reply stops the run.
- A failed provider or unconfirmed transport result stops the run without a
  canned replacement or a blind model retry. Workers have a 180-second provider
  timeout; the clerk also bounds the overall turn deadline.
- A new owner amendment cancels turns bound to old terms. An unsent obsolete
  request is cancelled in the outbox. Generated output is discarded if its turn
  became stale while the provider ran; late room replies are rejected too.
- The listener keeps polling while Codex runs. Pending amendments suspend
  scheduled work. A model recommendation never satisfies a human decision.
- Startup processes available stored source replies before recovery. An
  interrupted provider with no accepted result becomes a visible stopped turn;
  it is not automatically repeated after restart. A pending owner question
  survives restart.
- Either bound human can explicitly start a new bounded run with
  `@cvc-clerk NEGOTIATE C01` after a stop. Owners can always replace only their
  own brief. Another exhausted run cannot restart itself.

Switch may emit passive-agent onboarding or permission notices under an agent's
identity. Those are ordinary conversation, not structured results or new work.
The listener filters non-command advocate notices and does not schedule advisory
models from clerk-generated notices. The explicitly labelled legacy listener
verification harness remains supported. Real human advisory questions remain
available when no scheduled negotiation or owner question is active.

The runtime remains a local polling adapter to pinned Switch 0.31.0. This is not
a claim of native Console-managed model sessions or multi-machine ownership.
Room history is read completely through paged reads; see the README.

## Verification

`npm test` covers the full state machine with synthetic identities: both
mandates required, exact expected speaker, no preview before review, immutable
review target, owner-only amendment, decline, stale/duplicate outputs, model
failure, one repair, round limit, interrupted worker, actual-source ingestion,
retention of an older lead source in review context, and unchanged two-human
approval requirements. These unit fixtures never post to Switch.

`npm run check:negotiation` tests the real background listener with real Codex
and Switch. It creates/reuses the private `cvc-negotiation-verification` room
and appends only a clerk-addressing rule scoped to that room, preserving existing
agent policies. It uses a separate SQLite database and explicit synthetic owner
identities. Two adoptions and one amendment acceptance are test inputs in that
database; no human login is used to author them, and no final human approval is
generated. The rehearsal is labelled in its room and evidence.

The background listener must schedule the lead, creator, amendment pause,
revised lead, and final creator review without the verification driver invoking
those turns one by one. The check waits during the owner pause and after final
preparation to confirm no extra model is scheduled. It verifies the served
preview bytes against the manifest, export denial with zero approvals, and an
unchanged live C01 snapshot. There is no model fallback.

See [the observed result and actual source references](negotiation-live-result.json).
Private model logs, fixture databases and the unapproved rehearsal preview stay
under ignored `.runtime/negotiation-verification/` and `.runtime/provider-runs/`.
Run `npm run check:engine` separately for the live C01 agent-authority rejection.

The live case still requires its real owners' decisions. The rehearsal does
not establish real human agreement or that either person viewed a storyboard.
