# Delegates Courtroom — Product Spec

**Version:** 1.0
**Status:** Approved demo scope
**Date:** 2026-11-06

---

## 1. Product in one sentence

Two AI advocates negotiate through Switch; a three-judge theatrical courtroom makes the negotiation understandable and memorable while a clerk assembles the agreed plan.

## 2. Demo scope (approved)

- Frontend demo only; no backend wiring.
- Case: **Harshil GPT vs Daksh Claude** hackathon build.
- Branch `harshil-dev` only; local preview at `127.0.0.1:4173`.
- Scripted demo with deterministic event stream; not live Switch.

## 3. User journey

1. **Filing** — case topic created (e.g., "Plan our hackathon build").
2. **Intake** — each owner provides constraints to their advocate via interview/profile.
3. **Opening statements** — advocates disclose shared constraints.
4. **Motions and counter-motions** — advocates propose and challenge items (max four rounds).
5. **Judicial perspectives** — Fairness, Feasibility, Cost assessments shown as three judges' perspectives.
6. **Clerk ruling and plan update** — clerk records ruling, updates docket.
7. **Verdict** — final agreed plan published when all items resolved.
8. **Deadlock and appeal** — unresolved items after round limit go to owners for human decision (sample appeal included in demo).

## 4. In scope for frontend demo

- Separate cinematic intro → 75/25 workspace.
- Three equal original judges (Aki, Edmund, Mira) on elevated bench.
- Two advocates as provider marks (Harshil GPT, Daksh Claude).
- Persistent docket below stage.
- Switch chat panel (25%) as chat-first live view (scripted in demo).
- Objection / ruling / deadlock / appeal / final plan choreography.
- Provisional configurable judge role mapping.
- Event IDs + dedup + history + pause/step/restart + download + human appeal.

## 5. Out of scope

- Backend wiring; real Switch integration; live agent status; production deployments; paid calls; new accounts.