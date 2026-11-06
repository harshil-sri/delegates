# Courtroom frontend handoff

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

**How it works** explains the sample boundaries and offers an entrance replay.
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
| `frontend/public/styles.css` | Visual system, scene composition, motion, responsive views |
| `frontend/public/app.mjs` | Playback, DOM rendering, choreography, downloads, focus |
| `frontend/public/hearing.mjs` | Pure scripted events, reducer, deduplication, appeal, export |
| `frontend/public/art/` | Original layered SVG environment, seal, full-body character assets |
| `frontend/public/brands/` | Unmodified provider assets |
| `frontend/public/fonts/` | Self-hosted fonts and SIL Open Font License texts |
| `frontend/server.mjs` | Read-only local static server restricted to `public/` |
| `frontend/build.mjs` | Static export to ignored `dist/` |
| `.plans/courtroom-frontend-spec.md` | Interview decisions and scope |

Character identity and judging perspective are separate fields in the exported
`characters` array. The provisional assignment is Aki → Feasibility, Edmund →
Cost, Mira → Fairness. Swap those fields without altering character artwork.
This is a configurable presentation choice, not a claim about cultural identity
or gender. Three visual perspectives do not imply three running judge agents.

## Assets and design limits

The image-generation connector was not available, so the draft uses original
handcrafted SVG artwork rather than generated images or copied game artwork.
The full-body judge source files sit behind the bench overlay in the composed
scene. Their reusable transforms provide thinking, acceptance, narrowing, and
rejection cues, not production character rigs or lip-sync animation.

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
```

See the runner for local browser executable configuration.
Environment variables for the browser runner:
- `QA_MODULES`: Points to the `package.json` file for `createRequire` resolution (defaults to `/tmp/opencode/delegates-qa/package.json`).
- `CHROMIUM_EXECUTABLE`: Explicit path to a compatible Chromium browser executable (validated for existence). When unset, the runner checks `chromium.executablePath()`, then falls back to user cache paths under `~/.cache/ms-playwright/` (`chromium-1248`, `chromium-1234`, or headless shell variants) and standard system binary paths.

Browser evidence and exact results live in `design-review/final/` and `docs/frontend-browser-results.json`.
Automated accessibility checks supplement, rather than replace, keyboard and
visual inspection.

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
