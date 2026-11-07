# v1.1 functional rebuild verification

## Boundary

This is the running offline rebuild at `http://127.0.0.1:4173/`, not the static
Section 2A review on 4174. No backend, Switch connection, hosted deployment,
provider generation, account creation, or purchase was added. Work stays on
`harshil-dev`. The primary authored the implementation; support ran mechanical tests.

## Final checks

- `npm test`: 88 passed, zero failed (existing backend plus frontend tests).
- `npm run check`: passed.
- `npm run build`: passed.
- `node test/frontend-browser.mjs`: 22 passed, zero failed. Five viewports from
  1440 × 900 through 320 × 740; no horizontal document overflow or resource errors.
- Ten axe scans: desktop/mobile intro, court, appeal, verdict; mobile chat and
  docket. Zero reported WCAG violations, not a claim of exhaustive accessibility.
- `CHROMIUM_EXECUTABLE=/home/harshil/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome node test/frontend-v11-browser.mjs`:
  three passed, zero failed. Actual timed four-beat intro, foreground parallax,
  seven-second entry, reduced-motion runtime change, replay preservation,
  advocate-caption bounds, unique inline SVG IDs, changed-item focus.
- `git diff --check`: clean at the implementation gate.
- `graphify update .`: AST-only graph refresh, 922 nodes / 1,327 edges.

Detailed machine evidence: `docs/frontend-browser-results.json` and
`docs/frontend-v11-browser-results.json`. The initial new-suite launch lacked
the default Playwright browser. The explicit installed executable above fixed
the harness, without installing anything.

## Visual review actually performed

Opened desktop court, mobile court, 320px court, mobile chat, desktop appeal,
and the actual intro threshold/bench/advocate/final-wide screenshots. Corrected
SVG viewBox letterboxing, clipped advocate states, narrow-screen header spacing,
and a perspective strip that could otherwise imply an unapproved role mapping.
The last main browser gate regenerated court, ruling, appeal, verdict, docket,
chat and mobile screenshots in this directory.

Original regressions for the old invented names and `Deadlock.` copy were updated
to the v1.1 contract (unassigned art slots and high-contrast `DEADLOCK`). No hearing
reducer, round-limit, approval, history, export, or backend assertions were removed.

## Open art and integration gates

The new coherent three-character set has original costumes, transparent full-body
assets and independent head/body layers. It is **vector illustration study work,
not the painterly game-art finish requested by the blueprint**, and is not claimed
as approved final art. Seating/posture, expressions, richer pose assets and final
character fidelity still need an art pass. No image-generation connector was
exposed, and no paid generation was attempted. No study stand-in figures or copied
Capcom artwork are used by the application.

Character-to-perspective mapping remains explicitly null. Coordinated panel
thinking and individual perspective outcomes work; character-specific decision
gestures are defined but will only be attributed after an approved role mapping.
The room remains a truthful read-only scripted sample, not live Switch proof.
