# Courtroom frontend handoff

## Latest scope: judges only

The user liked the cinematic intro but not yet the dashboard. This pass changes
only shared judge assets, SVG reference namespacing, and provenance/accessibility
copy. The intro storyboard/timing, courtroom CSS/layout, hearing reducer and
backend are unchanged. Both scenes use the revised artwork.

With explicit user permission, Japanese and British characters now use transparent
extracts of the supplied Capcom reference art. The woman uses a new original
portrait/mantle over an adapted teal costume from the British reference. These
are local reference-art previews, not licensed public-release assets. Do not
publish `dist/` with these assets without resolving rights. The earlier SVG
studies remain preserved. Role mapping remains unassigned.

The reference bodies are standing poses, not a finished seated character rig.
The woman portrait remains a locally drawn vector adaptation, not generated
painted art. This pass prioritizes faithful reference appearance; seated poses,
expression sheets and final art approval remain open.

See `design-review/v1.1/implementation/judge-art-lineup.png` for the large
three-character comparison and `docs/frontend-asset-sources.md` for provenance.

## Open the demo

```sh
npm run dev
```

Visit **http://127.0.0.1:4173/**. The static server binds to the local machine only.
Set `PORT=4174` to use a different local port. Node.js 22.13 or newer is required.
The frontend has no runtime packages, external font requests, or provider calls.

The application is on `harshil-dev`. Nothing in `main` or the existing backend
engine, identity checks, approval protocol, or read-only case server was changed.

## Try the complete hearing

1. Watch the entrance, or use **Skip intro** immediately.
2. Select **Play hearing** for paced playback or **Next event** to advance manually.
3. Read the three perspectives when the bench rules. Expand a docket item to see
   the proposal, objection, and ruling that produced its current wording.
4. The fourth round reaches a deadlock. The appeal pauses playback and requires
   a sample joint decision. Neither option sends a message or deploys anything.
5. Continue to the final verdict, then select **Download the plan**. The Markdown
   file includes all four plan items, the sample appeal choice, and full history.
6. Use **Restart hearing** to clear the sample choice and replay from the start.

**Export record** is available before the verdict. This exports the record so
far, not a completed plan. The exported file explicitly identifies itself as a
scripted demo and does not claim authenticated human approval.

**About this hearing** explains the sample boundaries and offers an entrance replay.
**Show sample participants** opens the room participant list. Playback stops
when the browser tab is hidden. The introduction never starts sound.

On mobile and tablet, **The court**, **Switch room**, and **The docket** tabs
keep all content accessible without squeezing the desktop split onto a phone.
The desktop docket and conversation scroll independently. Reading older room
messages does not force the reader to the bottom when another event arrives.

## Code map

| File | Responsibility |
|---|---|
| `frontend/public/index.html` | Semantic layout, entrance, court, docket, room, appeal |
| `frontend/public/courtroom.css` | v1.1 visual system, layered composition, motion, responsive views |
| `frontend/public/app.mjs` | Playback, DOM rendering, choreography, downloads, focus |
| `frontend/public/hearing.mjs` | Pure scripted events, reducer, deduplication, appeal, export |
| `frontend/public/art/` | Original layered SVG environment, seal, full-body character assets |
| `frontend/public/brands/` | Unmodified provider assets |
| `frontend/public/fonts/` | Self-hosted fonts and SIL Open Font License texts |
| `frontend/server.mjs` | Read-only local static server restricted to `public/` |
| `frontend/build.mjs` | Static export to ignored `dist/` |
| `.plans/courtroom-frontend-spec.md` | Interview decisions and scope |

Character artwork and judging perspectives are separate exports in `hearing.mjs`.
The three art slots have no invented character names. `judgeRoleMapping` explicitly
leaves Fairness, Feasibility, and Cost unassigned (`null`). Once approved, map each
perspective to an art-slot ID there, independently of nationality or gender.
Until then, coordinated panel thinking and separate perspective markers communicate
assessments without attributing an accept/reject decision to a specific character.
Three visual perspectives do not imply three running judge agents.

## Assets and design limits

The v1.1 rebuild replaces the rejected render with a full-bleed layered chamber,
three new original seated full-body character studies, a thin open bench rail,
opposing advocate stations, and a continuous clerk's register. The old room,
judge assets, and `styles.css` are retained as unused historical files, not loaded.

The new three-character set lives in `art/panel/`. Trusted local SVGs load inline
with scene-specific IDs so their head/body layers can move independently. Image
fallbacks remain if articulated loading fails. These are detailed vector studies,
**not final painted game-art fidelity**. No image-generation connector was exposed;
no paid service was called. Art acceptance against the supplied Capcom references
remains open, as does user approval of the final three-character set.

The separate seven-second intro uses threshold, chamber, character, foreground,
and lighting layers. Camera beats occur at 0, 1.6, 3.4, and 5.1 seconds; Enter Court
appears at seven seconds. Skip is immediate. Reduced motion shows the static wide
view and Enter Court immediately. Replay preserves the hearing and pauses playback.

Desktop uses 75/25 at widths of 1200px or above. Compact widths use Court/Chat/Docket
tabs before chat becomes unreadably narrow. The docket shows current wording,
owner, last round/event, status and expandable history. **Show changed item**
locates the current plan item without automatically moving a reader's scroll.

See [asset provenance](frontend-asset-sources.md) for exact original provider
asset URLs, hashes, font sources, and licenses. The provider marks identify
sample advocates only. No endorsement or sponsorship is implied.

## Checks

```sh
npm run check
npm run test:frontend
npm test
npm run build
```

The browser runner uses optional QA packages, not runtime dependencies:

```sh
npm install --prefix /tmp/opencode/delegates-qa --no-audit --no-fund playwright@1.58.2 @axe-core/playwright@4.11.1
node test/frontend-browser.mjs
CHROMIUM_EXECUTABLE=/path/to/installed/chrome node test/frontend-v11-browser.mjs
```

See the runner for local browser executable configuration.
Environment variables for the browser runner:
- `QA_MODULES`: Points to the `package.json` file for `createRequire` resolution (defaults to `/tmp/opencode/delegates-qa/package.json`).
- `CHROMIUM_EXECUTABLE`: Explicit path to a compatible Chromium browser executable (validated for existence). When unset, the runner checks `chromium.executablePath()`, then falls back to user cache paths under `~/.cache/ms-playwright/` (`chromium-1248`, `chromium-1234`, or headless shell variants) and standard system binary paths.

Current browser evidence lives in `design-review/v1.1/implementation/` and
`docs/frontend-browser-results.json`; the older `design-review/final/` validates
only the rejected implementation. The Section 2A reference pack is under
`design-review/v1.1/`, separate from the running application.
Automated accessibility checks supplement, rather than replace, keyboard and
visual inspection.

The additional v1.1 runner verifies the actual four intro beats, layered camera
and foreground animation, seven-second entry, runtime reduced-motion changes,
replay preservation, complete advocate captions, unique SVG rig IDs, and changed
item focus. Its report is `docs/frontend-v11-browser-results.json`. Pass the same
installed Chromium path used by the main browser runner; a missing default
Playwright browser is a harness error, not evidence the intro was verified.

## Future live integration is deliberately not implemented

The existing backend describes a different, authenticated storyboard approval
workflow. The sample hearing does not call that workflow and is not a replacement
for its human consent rules. Do not treat the local sample appeal as consent.

Before adding a live mode, document the real event contract and transport,
validate ordering and event IDs, map backend states without inventing agent
activity, and verify the Switch message source. Keep the sample and live room
stores separate. Display live status only after a verified connection or
heartbeat. Leave writing to the native room until its supported write path,
authentication, and authority rules are verified. No guessed Switch endpoints
or implicit approval shortcuts belong in that adapter.

No deployment, billing change, new account, or live provider call was performed.
