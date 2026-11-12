# Delegates: Creative Veto Court — Spec v0.2 (Flip the Switch hackathon)

Status: reconciled with the implemented backend on Sat 7 Nov 2026, 03:30 IST.
v0.1 (Thu 5 Nov ideation) is summarized under "Changes from v0.1".
Deadline: Sat 7 Nov 2026, 11:59 PM IST. Internal target: submit by 6 PM IST.
Team: Harshil and Daksh. Track 2 (Best Personal or Creative Workflow), plus side tracks: Code with Wispr, Best Blog, #HowISwitch.

## 1. One-line pitch

**Agents negotiate. Humans sign.** Two people's AI advocates negotiate a creative
deliverable in a shared Switch room. A deterministic clerk enforces what each
person protects. When only a human can decide, the court pauses for that person.
The output is a storyboard both people approved: version-bound and
offline-verifiable. An advocate can argue for its owner, but it can never consent for them.

## 2. Judging criteria (published weights)

| Criterion | Weight | How this project answers it |
|---|---:|---|
| Use of Switch | 30% | One Switch room bridged to Mattermost. Five distinct Switch identities: two humans, two advocate agents, one clerk agent. Every decision is a real Switch message, and the receipt cites those message IDs. Without Switch there is no room, no identity and no decision. |
| Technical execution | 25% | Pinned Switch 0.31.0 stack via Docker. `npm test` (58 offline tests). Live checks (`check:engine`, `check:negotiation`). Self-healing room ingestion. Offline receipt verifier. |
| Creativity and impact | 25% | Consent for AI-negotiated creative work: likeness veto, owner-only amendments, approvals that expire when terms change. |
| Presentation | 20% | Courtroom frontend driven by `/api/cases/C01/stream`; README explains each Switch component. |

Source: the DevTools Academy judging table (30/25/25/20). Submit a public repo,
a short demo video and a README explaining how Switch is used.

## 3. Cast

| Role | Type | Authority |
|---|---|---|
| Lead advocate `cvc-lead-advocate` | Agent (Codex, read-only, schema-constrained) | Proposes four-panel storyboards. Cannot adopt, accept, approve. |
| Creator advocate `cvc-creator-advocate` | Agent (Codex) | Reviews the exact board (revision + SHA-256); may recommend, ask for a revision, ask an owner for an amendment, or block. Cannot decide. |
| Clerk / judge `cvc-clerk` | **Deterministic code**, not a model | Schedules turns, runs rule checks, pauses for humans, records decisions, freezes bundles. |
| Owners `court-owner` (lead, H briefs), `court-creator` (creator, D briefs) | Humans in Mattermost | The only ones who can adopt, amend, accept/decline, approve, revoke, restart. |

## 4. Case flow (implemented)

1. **Filing.** Case C01 opens with draft briefs H1 (lead: requires the portrait) and D1 (creator: forbids it). Each brief has protected terms (required/forbidden assets and copy) and negotiable terms.
2. **Mandates.** Each owner sends `@cvc-clerk ADOPT C01 <ref> <sha256>` from their own account. No model runs before both adopt.
3. **Argument.** The clerk summons the lead, who proposes BOARD1. Deterministic checks run: 4 panels, 30 s total, permitted assets, required/forbidden assets, exact copy.
4. **Objection.** The creator reviews the exact BOARD1. The portrait violates D1, so it asks for an amendment to H1 (an object-based treatment).
5. **Recess.** All advocate turns stop. Only `court-owner` can `ACCEPT` or `DECLINE` A1. Declining stops the run honestly; no compromise is inferred.
6. **Revision.** Accepting creates H2 and makes every earlier board stale. The lead proposes BOARD2 and the creator reviews and recommends it.
7. **Draft verdict.** The clerk freezes the HTML storyboard, script and manifest into one bundle digest.
8. **Signatures.** Both owners send the same `APPROVE C01 BOARD2 <digest>`. One signature is not enough. Any brief change or new board voids current approvals. `REVOKE` withdraws one's own.
9. **Verdict.** The export, script and receipt unlock. `npm run verify` checks them offline.

Bounds: at most 2 lead proposals per run and 1 schema repair per turn. Provider timeout is 180 s, turn deadline 240 s, and an undelivered request fails at 90 s. A stopped run restarts only by a human's `NEGOTIATE C01`.

## 5. Switch design (verified)

- **Verified:** one private Mattermost-bridged room; five distinct opaque Switch senders, frozen at setup; human Mattermost messages reach the clerk byte-exact under the bound sender (live check, 7 Nov 03:10 IST). Agents read history through `read_context` and post through `/agents/{id}/message`.
- **Verified:** the clerk rejects agent-authored human commands (`HUMAN_REQUIRED`) and Switch platform/on-behalf-of messages.
- **Room history:** complete reads, 500 per page with `before` paging (Switch maximum), merged by message ID.
- **Dropped (unverified in time):** private chambers per advocate, two-machine ownership, Switch-native Tasks/Decisions (upstream marks the task protocol not ready).
- Agents are external/passive HTTP agents driven by a local worker, not Console-managed sessions. Say so in the README and video.

## 6. Frontend: the courtroom (built by Harshil/Daksh)

Data source: `GET /api/cases/C01/court` (view model) plus `GET /api/cases/C01/stream` (SSE).
Contract: [docs/frontend-api.md](docs/frontend-api.md). The frontend is display-only; decisions stay in chat.
Key visual beats: `summons` → `proposal` → `objection` → `appeal` (freeze plus spotlight on one human) → `decision` → `endorsement` → `draft_verdict` → `signature` ×2 → `verdict`.
Show `overruled` with `agentOverreach: true` as a big moment. Art: original style, no copied characters.

## 7. Demo plan (≈3 minutes)

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:10 | Hook | "My AI agent just tried to approve a promo using my face. The court said no." The overruled `HUMAN_REQUIRED` beat. |
| 0:10–0:30 | The conflict | Two brief cards: Harshil requires the portrait; Daksh forbids it. Both adopt in Mattermost. |
| 0:30–1:15 | Argument | Lead proposes BOARD1 → creator objects with an owner question → court freezes on Harshil. |
| 1:15–1:45 | Human decision | Harshil accepts the object-based alternative in chat → H2 → BOARD2 → creator recommends. |
| 1:45–2:15 | Signatures | Both approve the same digest. Show that one signature leaves export locked. |
| 2:15–2:35 | Twist | Daksh amends D1 (adds a closing line) → both approvals void instantly ("consent doesn't transfer to a new version"). The run stops at its round limit; a human sends `NEGOTIATE C01` → BOARD3 → both re-approve. (Covered by a test; trim the turns in the edit.) |
| 2:35–2:50 | Proof | `npm run verify` PASS; flip one byte → FAIL. |
| 2:50–3:00 | Switch diagram | 2 humans + 2 agents + clerk in one Switch room; every decision is a Switch message. |

**Record the final demo in a fresh case or room.** The current C01 timeline has earlier rehearsal rejections.

## 8. Side tracks

- **Code with Wispr ($500):** dictate the prompts, README and blog; attach the Insights screenshot.
- **Best Blog:** "Building consent into multi-agent rooms with Switch": what Switch gave us, the clerk design, what broke (Docker, PowerShell, passive notices).
- **#HowISwitch:** one post with the 10-second hook clip, after submitting.

## 9. Gates (status)

| Gate | Result |
|---|---|
| G1 Stack and agent in Mattermost | Passed (spike, 6 Nov). |
| G2 Second machine | Not attempted; claim dropped. |
| G3 Private chambers | Not attempted; claim dropped. |
| G4 Frontend data source | Passed: `/court` plus SSE from the clerk's own database. |
| G5 Judge follows role | Replaced by the deterministic clerk; verified live. |
| G6 Human Mattermost commands reach the engine | Passed (live, 7 Nov). |
| G7 Ingestion survives Switch restart | Passed (live, 7 Nov). |

## 10. Timeline (Sat 7 Nov, IST)

- By 12:00: courtroom frontend on the stream; one full rehearsal with both humans; **feature freeze**.
- 12:00–16:00: record the demo (fresh case), README pass, push the public repo (keep `.runtime/` out).
- 16:00–18:00: blog, Wispr screenshot, submit. 18:00–23:59: buffer only.

## 11. Risks

1. Codex latency or failure during recording: rehearse; a failed turn shows as a recess and a human restarts with `NEGOTIATE`.
2. Docker Desktop on this machine: a stale `dockerInference` socket blocks startup. Move `%LOCALAPPDATA%\Docker\run` aside (done twice so far).
3. Timeline clutter in C01: record in a fresh case.
4. Overclaiming: the system attests which accounts sent decisions, not that a person read the preview; the advocates share one machine's Codex login.

## Changes from v0.1

| v0.1 | v0.2 | Why |
|---|---|---|
| Plan "our hackathon build" | SIGNAL promo storyboard with a likeness veto | Concrete conflict plus a tangible artifact. |
| AI judge (or panel of three) rules | Deterministic clerk; models only propose and review | Authority must not be a model. |
| Owners decide only on deadlock | Owners adopt, amend and sign everything binding | Consent is the product. |
| Private chambers, two machines | Dropped | Unverified in time. |
| Clerk posts JSON events to the frontend | Frontend reads the clerk's DB through `/court` and SSE | One source of truth. |
| Weights unknown | 30/25/25/20 | Published. |
