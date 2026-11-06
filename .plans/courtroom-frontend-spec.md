# Delegates Courtroom — Frontend Spec (Demo)

**Version:** 1.0
**Status:** Approved demo scope (design blueprint v1.0 + demo interview outcome)
**Date:** 2026-11-06

---

## 1. Scope

- Frontend is a **DEMO ONLY** build. **No backend wiring** in this scope.
- Demo case: **Harshil GPT vs Daksh Claude** hackathon build.
- Branch: `harshil-dev` only. No main branch, no deployments.
- Local preview only via `npm run dev` at `127.0.0.1:4173`.
- No paid calls, no new accounts; backend preserved.

## 2. Approved technical approach

- Standalone, dependency-free Node ESM static frontend under `frontend/`.
- Original layered SVG Victorian courtroom (fallback: original handcrafted SVG illustrated courtroom; no image-generation connector currently exposed).
- CSS animations and event-driven DOM state. No new runtime libraries.

## 3. Demo mode approach

- Clear **"scripted demo"** framing — not a live Switch experience.
- Deterministic mock event stream drives courtroom choreography, docket, transcript, and rulings.

## 4. Demo event sequence

1. **Objection** — objection emphasis on objecting advocate; relevant docket item highlighted.
2. **Ruling** — coordinated three-judge perspective sequence; consolidated ruling; docket status update.
3. **Deadlock** — high-contrast `DEADLOCK` banner; unresolved item marked `AWAITING APPEAL`.
4. **Human sample appeal** — explicit human decision point; appeal banner identifies both owners.
5. **Final plan** — final verdict sequence; final agreed plan; history preserved.

## 5. Implementation map

### Requirements

- FE demo only; no backend wiring.
- Standalone dependency-free static frontend under `frontend/`.
- Scripted demo, not live Switch.
- Approved final palette and typography.
- Provisional, independently configurable judge role mapping.
- Event vocabulary: objection / ruling / deadlock / human sample appeal / final plan.

### Approach

- Static composition first, then character art and state transitions.
- Original layered SVG Victorian courtroom with CSS animations; no new runtime libraries.

### Verification

- Local preview at `127.0.0.1:4173`.
- Verify scripted demo behavior locally; no backend wiring.

## 6. Boundaries and acceptance tests

- **Desktop:** 1440x900 primary demo target; 75% court / 25% Switch chat split.
- **Tablet / mobile:** responsive behavior per design blueprint §12.
- **Reduced motion:** `prefers-reduced-motion` respected.

## 7. Event handling requirements

- Event IDs + dedup strategy so scripted stream does not replay.
- Preserve full history; docket status changes must not erase prior sequence.
- Demo playback controls: pause / step / restart.
- Download affordance for final plan / verdict.
- Human sample appeal flow.

## 8. Out of scope

- Backend wiring, real Switch feed, live agents, production deployments.
