# Frontend visual review

The approved contract is `delegates-courtroom-design-blueprint.md`, narrowed by
the demo-only interview in `.plans/courtroom-frontend-spec.md`.

## Observed and corrected

1. **One judge was clipped at the left edge.** A selector counted only sibling
   `div` elements, not the background image. Character positioning now uses
   explicit identity selectors. All three judges share the same dimensions.
2. **The scene letterboxed inside the stage.** The SVG viewport and overlay
   coordinates did not share the same frame. The environment now fills its
   stage; character images retain their own natural proportions.
3. **The docket started below the desktop fold.** The primary desktop layout
   now budgets space for the court, dialogue, controls, and an independently
   scrolling docket. The room has its own scroll region. Appeal and verdict
   states may grow the document so their controls remain readable.
4. **The OpenAI brand-page image was a spacing diagram.** It was replaced by a
   single unmodified official mark. The light embedding color scheme lets the
   adaptive mark render black on a plain light surface without recoloring it.
5. **The entrance camera was positioned above the viewport.** A later shared
   scene rule overrode its coordinates. Intro positioning now has its own
   scoped rules. Layered doors open onto the scene, with no delay on Skip or Enter.

## Main-thread inspection

- Desktop: 1440 × 900, entrance, court, full appeal state, dialogue, and docket.
- Mobile: 390 × 844, entrance and court, all three judges and both advocates visible.
- The sampled pages had no horizontal overflow or missing images.
- Reduced-motion mode showed the static scene without the camera or doors.
- The human appeal paused the hearing and disabled automatic advance.

The separate browser report covers the repeatable interaction checks,
additional viewports, downloads, and automated accessibility scans.

## Intentional draft limits

The artwork is an original, editable SVG prototype, not a commissioned raster
illustration, Rive rig, or production sprite library. The characters' full-body
source artwork is composed behind the judicial bench. The sample is explicitly
scripted and does not establish that any real AI agents or Switch feed work.
No sound, scroll hijacking, or unskippable cinematic is used.
