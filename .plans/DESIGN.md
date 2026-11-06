# Delegates Courtroom — Design Spec

**Version:** 1.0
**Status:** Approved
**Date:** 2026-11-06

---

## 1. Visual thesis

Grand Victorian courtroom as hand-drawn courtroom adventure. Two AI advocates on opposite sides of the floor, three original judges on an elevated shared bench, living docket below stage, narrow authentic Switch chat panel on the right. The experience feels theatrical, intelligent, and alive — not cute, corporate, or generic.

## 2. Approved final palette (autonomous)

| Token | Value | Use |
| Ink | #211B19 | Deep text, shadows, dark framing |
| Walnut | #30221D | Main dark wood |
| Oxblood | #6A3038 | Velvet, active-case accents |
| Brass | #B18B53 | Decorative metal, small highlights |
| Parchment | #E8DDC8 | Docket paper, warm light surfaces |
| Chalk | #F4EFE5 | High-contrast light text surfaces |

Semantic colors (muted sage, muted red) used sparingly for status; never rely on color alone for status communication.

## 3. Typography

- **Display / case titles:** Large Cormorant serif ceremonial titles.
- **Interface / controls / messages:** Clear sans serif (e.g., Inter or Manrope).
- **Technical metadata / timestamps / event labels:** IBM Plex Mono (sparingly).

Do not use ornate Victorian fonts for long dialogue or Switch chat; transcript must remain effortless to scan.

## 4. Physical scene

- Hackathon judges watching theatrical courtroom on laptop at dim event desk.
- Dark timber stage contrasts clean parchment transcript.
- 75% courtroom / 25% Switch panel split on desktop.

## 5. Judges — Aki, Edmund, Mira

- **Equal original judge characters**, full-body, together on one elevated bench.
- **Roles independently configurable** with provisional mapping approved (Fairness, Feasibility, Cost).
- **Three scripted perspectives**, not three real agents.
- **Visual stability** across idle, listening, thinking, speaking, accept, reject, and narrow states.

## 6. Motion and character states

- **Balanced motion** — driven by events, not arbitrary timers.
- **Judge states:** idle, listening, thinking, speaking, accept, reject, narrow.
- **Advocate states:** idle, thinking, speaking, objection, accepted, rejected, waiting.
- **No continuous motion** — only key moments animate (opening, ruling, objection, verdict, deadlock).
- **Reduced motion** respects `prefers-reduced-motion`; camera intro becomes static/short transition.

## 7. Layout and composition

- **Desktop:** 75% courtroom / 25% Switch chat split; Switch panel visible and usable.
- **Stage:** judges elevated above floor; advocates face inward; dialogue readable near stage.
- **Docket:** persistent below stage; expandable/collapsible; scrollable independently.
- **Hero intro:** separate cinematic screen; camera-like movement reveals courtroom; `Skip intro` available.

## 8. Event-to-interface mapping (demo sequence)

- Objection → red emphasis on objecting advocate; docket item highlighted.
- Ruling → coordinated three-judge perspective sequence; docket item status updated.
- Deadlock → high-contrast `DEADLOCK` banner; item marked `AWAITING APPEAL`.
- Human sample appeal → explicit human decision; appeal banner names both owners.
- Final plan → final verdict sequence; final agreed plan published; history preserved.

## 9. Acceptance criteria (demo)

- Courtroom reads immediately as grand Victorian-inspired courtroom.
- Illustration style is hand-drawn game art, not generic vector mascot art.
- Japanese-inspired and British-inspired judge references adapted into original artwork.
- Third judge is original woman character in same visual universe.
- All three judges equal prominence; sit together on one elevated bench.
- Two advocates are provider marks (Harshil GPT vs Daksh Claude), not human lawyer characters.
- Provider logos remain intact and follow brand usage guidance.
- Scripted demo with clear labeling; no live Switch feed.
- 75/25 desktop layout maintained when space permits.
- Docket persists below stage; status updates visible.
- Deadlock, appeal, verdict have distinct readable states.
- Event IDs + dedup + history + pause/step/restart + download + human appeal.
- Reduced motion respected; no critical content depends on sound or animation.
- Keyboard navigation, visible focus, contrast, and accessibility tested.