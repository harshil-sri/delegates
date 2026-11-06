# Courtroom frontend API

The backend is read-only. The frontend **displays** the court; every decision
is still a message a bound human sends in the Switch/Mattermost room. Do not add
approve buttons that call the backend. They would bypass the consent model,
and the server rejects anything except `GET`/`HEAD` with `405`.

Base URL: `http://localhost:18802` (loopback only; the `Host` header must be
`localhost:18802` or `127.0.0.1:18802`).

## CORS

These origins can read the API from a dev server by default:
`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`,
`http://127.0.0.1:3000`. To use others, start the workers with a
comma-separated list:

```powershell
$env:CVC_FRONTEND_ORIGINS = 'http://localhost:5174,http://localhost:3000'; .\scripts\start-workers.ps1
```

A Vite proxy (`/api` → `http://localhost:18802`, `changeOrigin: true`) also works and needs no CORS.

## Endpoints

| Route | Use |
|---|---|
| `GET /api/cases/C01/court` | **The one to render.** The full courtroom view model (below). |
| `GET /api/cases/C01/stream` | Live server-sent events. Use `new EventSource(url)`. |
| `GET /health` | `ingestion.state` is `starting`, `live` or `paused` (with `reason`). Show a "court in recess: connection lost" banner when paused. |
| `GET /api/cases/C01/boards/{n}/preview` | Frozen storyboard HTML for review. Use an `<iframe>` or a link. |
| `GET /api/cases/C01/boards/{n}/manifest` | Exact bundle manifest and digest. |
| `GET /api/cases/C01/boards/{n}/export` · `/script` · `/receipt` | Only after both approvals (`409` before). |
| `GET /api/cases/C01` · `/events?after=` | Raw engine snapshot and event log (debugging). |

## Live stream

```js
const court = new EventSource('http://localhost:18802/api/cases/C01/stream');
court.addEventListener('court', e => render(JSON.parse(e.data)));      // full view, after every change
court.addEventListener('beat', e => animate(JSON.parse(e.data)));      // one courtroom moment
court.addEventListener('ingestion', e => banner(JSON.parse(e.data)));  // paused / live
```

On connect you receive one `court` event. After that you get `beat` events
(each with `id` = event ID) followed by a fresh `court`. The browser resumes
automatically with `Last-Event-ID`, receiving only the beats you missed. A
heartbeat comment is sent every 15 s. Up to 16 concurrent streams are allowed.

## View model (`cvc-court-view-v1`)

```jsonc
{
  "version": "cvc-court-view-v1",
  "caseId": "C01",
  "stage": "NEEDS_HUMAN",                 // engine stage
  "phase": {                              // what the courtroom should show now
    "code": "RECESS",                     // FILING | ARGUMENT | RECESS | DEADLOCK | SIGNATURES | VERDICT
    "label": "Court in recess",
    "detail": "Only court-owner can decide A1. No advocate turns run until then.",
    "speaker": "owner:lead",              // who should be highlighted (or null)
    "waitingOn": ["owner:lead"]
  },
  "cast": {
    "clerk": { "name": "cvc-clerk", "kind": "deterministic", "authority": "…" },
    "advocates": { "lead": { "name": "cvc-lead-advocate", "represents": "court-owner" }, "creator": { … } },
    "owners": { "lead": { "username": "court-owner", "briefRef": "H1", "adopted": true, "signed": false, "brief": { … } }, "creator": { … } }
  },
  "question": {                           // non-null only while a human must decide
    "requestId": "A1", "owner": "owner:lead", "replaces": "H1",
    "reason": "May objects replace the portrait?",
    "replacement": { … }, "accept": "@cvc-clerk ACCEPT C01 A1 …", "decline": "@cvc-clerk DECLINE C01 A1 …"
  },
  "negotiation": { "status": "needs_human", "run": 1, "proposals": 1, "maxProposals": 2, "block": null, "restart": null },
  "board": {                              // latest candidate, or null
    "revision": 2, "title": "…", "stale": false, "passed": true,
    "panels": [{ "seconds": 6, "assetId": "notebook", "scene": "…", "onScreen": "…", "voiceover": "…" }],
    "checks": [{ "code": "FOUR_PANELS", "passed": true, "detail": "Exactly four panels." }],
    "review": { "decision": "recommend", "summary": "…" },
    "bundleDigest": "…", "preview": "/api/cases/C01/boards/2/preview", "manifest": "…"
  },
  "approvals": { "lead": true, "creator": false, "count": 1, "command": "@cvc-clerk APPROVE C01 BOARD2 …" },
  "adopt": { "creator": "@cvc-clerk ADOPT C01 D1 …" },   // owners who still need to adopt
  "exports": null,                                        // { html, script, receipt } once APPROVED
  "ingestion": { "state": "live", … },
  "beats": [ /* the whole story so far, oldest first; see below */ ]
}
```

Speakers are `clerk`, `lead`, `creator` (the advocates), `owner:lead` and `owner:creator` (the humans).

## Beats: the courtroom script

Every beat has `id`, `at` (ms), `type`, `speaker`, `kind` (raw engine event),
`text` (the clerk's actual message in Switch, if any) and `roomMessageId` (its
Switch message ID). Type-specific fields:

| `type` | Speaker | Meaning, suggested animation | Extra fields |
|---|---|---|---|
| `filing` | clerk | Case opens. | |
| `procedure` | clerk / owner | Automation enabled, or a human restarted the run. | `run` |
| `mandate` | owner:* | A human adopted or replaced their brief. Seal/stamp on their card. | `role`, `ref`, `replaces?` |
| `summons` | clerk | Clerk calls an advocate to speak. Gavel tap, spotlight `target`. | `target`, `phase`, `boardRevision` |
| `deliberating` | lead / creator | Advocate is thinking (model running). Typing/pondering pose. | `turnId` |
| `proposal` | lead | Lead presents a storyboard. Speech bubble = `quote`. | `quote`, `boardRevision` |
| `ruling` | clerk | Board passes the deterministic rules. | `passed`, `checks` |
| `objection` | clerk or creator | `basis:"rules"`: the clerk's checks failed (`failed[]`). `basis:"review"`: the creator objects (`quote`, `notes`, `ownerQuestion`). **"OBJECTION!" moment.** | `basis`, … |
| `endorsement` | creator | Creator recommends the exact board (advisory, not consent). | `quote` |
| `appeal` | clerk | A question only a human can answer. Court freezes, spotlight on `awaiting`. | `awaiting`, `requestId` |
| `decision` | owner:* | The human accepted or declined. | `accepted`, `ref` |
| `draft_verdict` | clerk | Frozen preview ready for signatures. | `digest` |
| `signature` | owner:* | One human approved. Signature on their side. | `role`, `digest` |
| `withdrawal` | owner:* | A human revoked their approval. | `role` |
| `verdict` | clerk | Both humans signed the exact bundle. Final gavel. | `digest` |
| `recess` | clerk | Negotiation stopped (declined, round limit, failure). | `code`, `reason` |
| `turn_failed` | clerk | An advocate turn failed or timed out. | `code`, `reason` |
| `overruled` | anyone | A command was rejected. **`agentOverreach: true`** means an advocate tried to make a human decision (`HUMAN_REQUIRED`). That's the "the advocate is not the client" moment. | `code`, `reason`, `agentOverreach` |

`status` checks are omitted from `beats`. The view keeps the last 500 events.
