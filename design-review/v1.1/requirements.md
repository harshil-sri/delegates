# v1.1 redesign contract and traceability

Source of truth: `docs/design/delegates-courtroom-design-blueprint-v1.1.md`, all 863 lines.
This review supersedes the old implementation's visual direction, not the
working backend or existing consent rules. The November 7 artwork is rejected.

## Implementation follow-through after “continue”

The application now loads a new `courtroom.css` visual system, a layered full-bleed
chamber, separate advocate stations, and a newly authored three-character seated
set in `frontend/public/art/panel/`. None of the review's generic stand-ins are
included. Head/body layers animate independently; shared perspectives remain
unassigned in `judgeRoleMapping`. Invented character names are removed from the
runtime. The old visual system remains unused, not layered under the new styles.

The separate intro has four camera beats, native CSS parallax and a seven-second
CTA, with immediate skip and a static reduced-motion path. The working view uses
75/25 from 1200px, switching to tabs earlier rather than compressing chat. The
clerk's register shows current wording and last round, keeps history and disclosure
state, and offers a user-triggered changed-item locator. All sample hearing flow
and export logic remain in the existing reducer.

**Not closed:** final painted game-art fidelity, final three-character art approval,
approved character-role mapping, and any actual Switch transport or live agents.
The new illustrations are original detailed vector studies, not represented as
approved final art. The build is a functional offline rebuild, not a live demo or
a claim that every final art acceptance checkbox has passed.

The remainder of this document records the original pre-build traceability;
see `docs/frontend-handoff.md` and browser result JSON for current evidence.

## Historical milestone: Section 2A, before full implementation

| Required review material | Artifact | Honest status |
|---|---|---|
| Exact Japanese and British judge references side by side | `index.html#characters`, local attributed reference images and original source links | Both artwork and concept sheets opened and visually inspected |
| Proposed original woman at the same scale/treatment | `woman-concept.svg` in the same-height lineup | Full-body ink-and-colour rough; NOT final painted fidelity or approved art |
| Full-room composition with three judges and two model marks | `courtroom-composition.svg`, `workspace.html` | Original architectural rough; three equal seated full-body placement stand-ins; not final characters |
| Four intro frames | `index.html#storyboard` | Entry/aisle, bench, advocate, wide shot; static framing studies, not implemented camera motion |
| 75/25 desktop layout | `workspace.html` | Real browser-rendered structural study; source-message styling demonstrated with explicitly offline sample copy |

The study does not establish final character-art quality. Approval of spatial
layout does not approve its temporary figures for shipping. No production
application files are being replaced before this gate is reviewed.

## Physical scene and colour strategy

Hackathon judges watch a hearing on a laptop in a dim venue: warm plaster and
daylit upper arches keep faces legible above a dark timber floor, while an
untextured light room panel remains readable at a glance.

Committed material palette, not a generic dark dashboard: walnut and mahogany
carry the room; lighter plaster establishes height; oxblood marks velvet and
ceremony; brass is structural hardware and controlled emphasis; parchment is
confined to the clerk's actual register. Colour-wash and ink roughs in this
study are not the final surface texture.

## Every blueprint section accounted for

| Blueprint | Design/build requirement | Plan and verification gate |
|---|---|---|
| 1: Purpose | Performance plus credible underlying collaboration | Preserve simultaneous scene, message transcript, and evolving record. No theatrical effect hides original text. |
| 2: Approved decisions | Victorian 2D world, equal original judges, logo advocates, separate intro, 75/25, docket below | These are constraints, not optional aesthetic suggestions. Replace the old art and layout rather than polish it. |
| 2A: Rejection and reset | No shallow strip, tiny busts, invented names, app tiles, dashboard card, or faux metadata | This study is the required pre-build gate. Final visual comparison must use the references, not the old screenshot. |
| 3: Thesis | Courtroom adventure, not SaaS, law-firm marketing, chibi, or 3D | Full-height room, substantial figures, open foreground, limited chrome. Review one representative 1440 × 900 screen before expanding implementation. |
| 4: Actual references | Open and inspect R1–R7 | See reference evidence below. Nintendo Life 403 is recorded, not concealed. |
| 5: World | Architectural depth, materials, directional light, controlled detail | Ceiling and gallery planes, shared raised bench, convergent floor, foreground stations. Do not add constant particles or busy texture behind type. |
| 5.2–5.4: Tokens | Palette proposals not separately approved; legible serif/sans split | Existing licensed Cormorant and Plex can be retained if they pass the new screen. Essential UI uses readable sizes, not micro-label decoration. |
| 6.1: Judges | Original full-body art, equal scale, coherent technique, distinct silhouettes | Produce the three final characters together. Equal seated baselines and face sizes; rig layers/poses preserve identity. No invented names. Role mapping stays unassigned until chosen. |
| 6.2: Advocates | Recognisable configured model marks, intact trademarks | Existing official assets stay separate. Surrounding spotlights, platforms, nameplates and speaker cues animate; logos do not morph or receive texture. |
| 7.1–7.2: States | Idle/listen/think/speak/accept/reject/narrow; advocate state vocabulary | Drive from confirmed events in a live mode, explicitly scripted events in demo mode. Neutral listening where processing state is unavailable. Do not label simulated processing as actual agent activity. |
| 7.3: Choreography | One ruling ID coordinates the whole panel | Settle advocates, think together, stagger assessments, retain ruling, apply per-perspective decisions, update docket, return to listening. Duplicate IDs do not replay. |
| 7.4: Signature moments | Intro, ruling, objection, final verdict, deadlock/appeal | Reserve drama for these. Keep smaller updates short and functional. Text never fades to illegibility. |
| 7.5: Tooling | Inspect before selecting animation framework | Node ESM, CSS, no runtime packages currently. Rive inspected as candidate only; no authored `.riv` assets exist. Do not add it to compensate for missing art. Layered poses and native timelines remain candidates. |
| 8: Intro | Separate 5–8s camera sequence, always skippable, no sound | Proposed seven-second four-beat storyboard. Layered parallax, static-wide reduced motion, no forced replay. Final wide scene settles into the workspace rather than switching to unrelated composition. |
| 9.1–9.3: Layout | 75/25 where readable; judges and advocates visible | Representative 1440 × 900 first; minimum chat width; switch to tabs/drawer before shrinking figures. Stage dominates, docket below; no decorative illustration card. |
| 9.4: Dialogue | Source name, owner/model, round, original full text | Restrained adjacent dialogue strip, expansion for long text, complete transcript always retained. |
| 9.5: Docket | Wording, status, last ruling/round, grounded attribution, expand history | Continuous clerk register, not cards. Independent scrolling, in-place changes, locate changed item, preserve focus and history. Study shows wording/status; final data bindings still pending. |
| 9.6: Special states | Distinct objection, ruling, deadlock, appeal, verdict | Persistent textual banners and relevant item highlight. Appeal identifies both owners AND unresolved launch question. Final plan preserves full history and human decision. |
| 10: Switch panel | Genuine messages in connected mode | Existing authorisation is frontend-only, so remain labelled offline. No connected mode claimed or added by this redesign. A future authorised spike must verify exact transport, auth, CORS, ordering and message source. |
| 10.2–10.3: Room behaviour | Participants, chronology, original formatting, timestamps, preserve scroll, unread indicator | Retain working read-only behaviour. Native room link only if configured. No custom composer until verified write path. No fake green LIVE badge. |
| 10.3–10.4: Connection/bridge | Connecting, reconnecting, stale, disconnected, unavailable | Real connection state and last update only from verified transport. Clerk JSON bridge is not described as raw-chat mirror without complete message forwarding. No guessed Gateway endpoints. |
| 11: Journey | Filing, private intake, openings, ≤4 rounds, assessment, record, verdict/appeal | Preserve sample case flow. No setup wizard and no private information in shared transcript. Live filing/intake remain outside current demo scope. |
| 12: Responsive | Desktop primary; smaller layouts remain usable | Desktop 1440 × 900, compact 1024 × 768, tablet 768 × 1024, phones 390 × 844 and 320 × 740. Court/chat/docket tabs or drawers; do not scale a desktop screenshot into a phone. Study itself is not the responsive production implementation. |
| 13: Accessibility | Reduced motion, keyboard, labels, contrast, transcript, comfortable targets | Test focus through intro/appeal/verdict, details and tabs. Text/state survives no animation. Touch targets and readable type take priority over decorative labels. No sound autoplay. |
| 14: Event vocabulary | Eight existing types; draft schema not a live contract | Preserve reducer/event IDs/history in `hearing.mjs`; adapt presentation around it. Do not invent backend schema support. |
| 15: Assets | Environment, bench overlay, three complete characters and states, marks, stations, insignia, intro layers | Original rough here establishes composition only. Inventory each final asset with source and status; transparent characters, shared baseline, stable pose transitions, names by slot/state until mapping approved. |
| 16: Build order | Static → art/state → authorised feed spike → docket/flow → QA | Respect Section 2A before full implementation. Keep existing architecture, dependencies and backend; no library collection, no deployment. |
| 17: Acceptance | Art, intro, workspace, truthful integration, motion/accessibility | All final-product checkboxes remain pending this rebuild. Old test passes are not evidence the new visual direction is accepted. |
| 18: Open decisions | Topology, role mapping, transport, write path, stack, palette/type, copy/sound | Backend topology and mapping remain open. Stack inspected, not changed. Palette/type tested in study; no final brand approval claimed. Sound off. |
| 19: Agent handoff | Read rejection/references first; deliver working frontend | Full frontend implementation follows review. This first artifact is deliberately NOT called a complete redesign. |

## Reference evidence and interpretation

- **R1/R2:** Both specific artwork pages, concept pages, and all four actual
  image sheets opened. Observed painted shadow planes, weighted outlines,
  developed costume shapes, non-generic faces, front/side silhouette thinking.
- **R3:** Exact Nintendo Life article and image attempted; both return 403,
  including a browser request. Opened the blueprint's PlayStation alternative
  and visually inspected its six official screenshots. Screen 6 demonstrates
  foreground presence, layered columns and adjacent dialogue. It is not the
  missing whole-court wide shot. No claim that exact wide reference was seen.
- **R4:** Opened museum page and inspected its actual historic-room photo.
  Observed coffered ceiling, upper galleries, velvet arch recesses, clear timber
  foreground and raised bench. The supplied percent-escaped image URL was
  resolved using the real image URL on the museum page.
- **R5:** Opened official press kit and inspected the supplied dialogue image.
  Observed fine engraving lines and large characters with paper dialogue.
- **R6:** Opened game page and inspected an actual screenshot. The selected
  image is a case-file/participants screen, not proof of its courtroom motion.
- **R7:** Opened character-animation page, feature overview and linked state
  machine documentation. Reviewed rig/state principles; no Rive demo motion
  was watched or Rive file authored. No Rive dependency is proposed yet.

Source images in `references/` are local review copies only, retain third-party
rights, and must not be shipped in `frontend/public` or used as final assets.
Original roughs, references, and placeholders are labelled separately.

## Implementation map after direction review

| Need | Existing resource | Planned change | Risk / verification |
|---|---|---|---|
| Scene | Replace old environment and bench | Original layered 2D art based on approved spatial study | Final art quality is the largest open risk; inspect at stage scale before rigging |
| Characters | Old vectors explicitly rejected | New unified original full-body set, then state poses | No image-generation connector exposed; no paid calls/accounts allowed. Do not hide this with generic vector stand-ins |
| Typography | Licensed self-hosted Cormorant/Plex | Recalibrate display vs readable functional scale | Check 25% chat and mobile; avoid tiny faux metadata |
| Layout | Semantic HTML, dependency-free static server | Rebuild visual hierarchy and scene composition | Preserve behaviour, IDs where helpful, test new desktop fold and responsive tabs |
| Intro | Existing entry/skip/focus logic | Replace old intro with four-stage camera timeline | Verify seven-second sequence, immediate skip, reduced motion, replay without unintended reset |
| Motion | Event-driven renderer and deduplication | Bind approved asset states to one coordinated ruling | Stable identity/pose baseline; check pause/rapid stepping clears previous choreography |
| Plan/chat | Existing pure reducer, history, scroll indicator and exports | New document register and flatter real-chat presentation | No erased rationale, fabricated source data, focus loss or scroll yanking |
| Live mode | No authorised frontend adapter | Not part of redesign; document separate future spike | Never equate read-only prototype or event bridge to live raw-room proof |
| QA | Existing Node tests, optional Playwright/axe runner | Retain behavioural regression tests; rewrite visual expectations | Old screenshots and pass counts do not validate the new design |

## Review decision needed

Approve or revise **room depth and framing, character costume direction, the
75/25 hierarchy, and the four-beat intro**. That does not approve placeholder
figures as final artwork. Final character-art fidelity must pass its own review
before extensive integration and animation work.
