# Delegates Courtroom — Art Direction & Frontend Design Blueprint

**Version:** 1.0  
**Status:** Art direction approved; technical integration details marked where they still require a spike  
**Project:** Delegates: Courtroom — Flip the Switch hackathon  
**Owners:** Harshil and Daksh  
**Primary purpose:** A live, theatrical interface that makes two AI advocates negotiating through Switch understandable and memorable.

---

## 1. Product in one sentence

Two people each own an AI advocate. Their advocates debate in a shared Switch room, a three-member judicial panel evaluates the proposals from different perspectives, and a clerk records decisions while assembling one agreed plan. Humans intervene when the court reaches a deadlock.

The frontend has two jobs:

1. Make the negotiation feel like a live courtroom performance.
2. Make the underlying Switch collaboration visible and credible to hackathon judges.

The theatrical layer must never hide the actual agent conversation, decisions, or evolving plan.

## 2. Confirmed creative decisions

These decisions were explicitly selected during the design exploration and should be treated as approved.

| Area | Approved direction |
|---|---|
| Overall visual concept | Theatrical, animated courtroom; not a conventional AI dashboard |
| Courtroom environment | Grand, traditional Victorian-inspired courtroom |
| Illustration | Hand-drawn game art, inspired by courtroom adventure games |
| Judges | Three equally prominent, full-body illustrated characters seated together on one elevated bench |
| Judge references | The Empire of Japan Judge and British Empire Judge concepts from *The Great Ace Attorney Chronicles* are visual references; create original artwork rather than reuse either character |
| Third judge | An original woman judge designed in the same illustrated universe and visual quality as the other two |
| Judicial perspectives | Fairness, feasibility, and cost; these are perspectives, not different AI-provider brands |
| Advocates | The actual AI provider/model identities represented by their recognizable logos (for example GPT/ChatGPT and Claude Code) |
| Advocate treatment | The logo is the character identity; do not replace it with a human lawyer mascot |
| Hero introduction | A separate cinematic introduction using a camera-like move through the illustrated courtroom |
| Workspace layout | Courtroom occupies 75% of desktop width; Switch conversation panel occupies 25% on the right |
| Switch panel | Chat-first presentation of the actual Switch room conversation |
| Plan placement | Persistent docket below the courtroom stage, expandable for detail |
| Motion | Balanced: subtle idle motion, expressive speech/reaction, more dramatic ruling moments |

### Important distinction: what the three judges represent

The three judges are **not three AI brands**. They are three original characters who embody three evaluative perspectives:

- **Fairness:** Are the responsibilities, benefits, workload, and constraints distributed reasonably?
- **Feasibility:** Can this proposal actually be delivered with the available time, people, tools, and dependencies?
- **Cost:** What are the financial, compute, time, maintenance, and opportunity costs?

The exact mapping between the Japanese-inspired judge, British-inspired judge, and original woman judge and these three roles has **not** been selected. Do not silently assign roles based on gender, nationality, or visual stereotypes. Keep the roles and character artwork independently configurable.

### Important distinction: visual judges versus backend agents

The frontend must show three equal judges. The project spec currently describes a Judge agent, with the panel as an open question. It is not yet established whether the running implementation will use three distinct judge agents or one judge/evaluator producing three structured perspectives.

The interface must not claim that three separate AI agents are running unless that is true in Switch. Keep a presentation layer with three judge identities and a backend mapping that can later be configured as either:

- three actual judge agents, one per perspective; or
- one judge agent that emits three distinct perspective assessments.

For a time-constrained demo, the second option may be simpler, but the implementation team should choose based on what is genuinely running.

---

## 3. Visual thesis

**A grand Victorian courtroom brought to life as a hand-drawn courtroom adventure: two model identities argue from opposite sides of the floor, three original judges preside from an elevated shared bench, and a living docket records how the court turns disagreement into a plan. A narrow but authentic Switch chat panel shows the real collaboration beneath the performance.**

The experience should feel theatrical, intelligent, slightly old-world, and alive—not cute, not corporate, and not like a generic agent-monitoring dashboard.

### What it should not look like

- A generic dark SaaS dashboard with a courtroom illustration pasted into the hero.
- A children's cartoon or chibi mascot game.
- A photorealistic legal website or law-firm landing page.
- A 3D game environment requiring extensive real-time rendering.
- A chat application with decorative judge avatars.
- A dashboard where the courtroom, transcript, and plan all compete at the same visual weight.

---

## 4. Reference matrix

Use references for principles, not for cloning characters, art, branding, layouts, or proprietary assets.

| Reference | What to study | How to adapt it | What not to copy | Evidence / scope |
|---|---|---|---|---|
| [Jury Trial — Loge Games](https://loge-games.itch.io/jury-trial) | Theatrical courtroom composition, opposing participants, stage hierarchy, judge placement | Primary inspiration for making the courtroom the central event | Exact characters, scenes, artwork, dialogue, or game UI | Previously inspected during the inspiration round; downloadable game reference |
| [The Great Ace Attorney Chronicles — Empire of Japan Judge concept art](https://creativeuncut.com/art_the-great-ace-attorney-chronicles_c.html) | Full-body judge design, costume silhouette, pose, expression, detail | One character-design reference for an original judge | Exact character drawing, costume design, poses, or extracted assets | Gallery lists Empire of Japan Judge and concept art; third-party gallery |
| [The Great Ace Attorney Chronicles — British Empire Judge concept art](https://www.creativeuncut.com/art_the-great-ace-attorney-chronicles_b.html) | Robes, judicial presence, facial expression, idle/reaction sprite vocabulary | Second character-design reference for an original judge | Exact artwork, wig/face copy, sprite sheets, or animation frames | Gallery lists British Empire Judge and concept art; third-party gallery |
| [Aviary Attorney — Official press kit](https://www.aviaryattorney.com/press.html) | Nineteenth-century lithograph character/background treatment and period atmosphere | Secondary reference for paper/ink texture and old-world visual character | Its animal-person premise or exact art | Official press kit says it uses genuine nineteenth-century lithographs for character art and backgrounds |
| [Rive — Features](https://rive.app/features) | State machines, transitions, listeners, events, data binding | Candidate workflow for mapping live events to character animation states | Do not adopt Rive merely because it is available; validate fit and timeline | Official Rive page documents state machines, transitions, listeners, and events |
| [Switch — Getting Started](https://www.switchagents.ai/blog-posts/switch-getting-started) | Rooms, agents, supported chat platforms, setup model | Source for the real collaboration surface that the side panel should reveal | Do not portray Switch as an agent provider or as a replacement chat app | Current public Switch explainer; dated August 26, 2026 |
| [Switch — GitHub repository](https://github.com/sandbox-quantum/switch) | Current repo architecture, Gateway directory, collaboration integrations | Validate actual supported data path before implementing the panel | Do not invent Gateway endpoints or rely on old architecture documents | Public repository; current README describes rooms and integrations |
| [OpenAI brand guidelines](https://openai.com/brand/) | Proper display and handling of OpenAI marks | Preserve provider marks and their approved proportions/clear space | Do not recolour, stretch, crop, texture, add effects, or imply endorsement | Official brand guidelines; check the current guidance for every provider used |

### Reference interpretation

The strongest combination is:

- **Jury Trial** for the stage composition and theatricality.
- **The Great Ace Attorney Chronicles** for the judge character lineage and expressive sprite vocabulary.
- **Aviary Attorney** for period atmosphere and the possibility of subtle print/ink texture.
- **Rive or an equivalent state-driven animation workflow** for connecting character states to real application events.

These references should converge into an original Delegates visual identity. They are not a request to recreate any one game's screen.

---

## 5. Art direction: the courtroom world

### 5.1 Environment

Build a grand Victorian-inspired courtroom with a strong sense of physical space.

**Core ingredients:**

- Dark walnut and mahogany timber.
- A large, elevated judicial bench with carved panels.
- Burgundy or oxblood velvet accents, restrained rather than saturated everywhere.
- Brass or aged-gold hardware and insignia.
- Tall windows, high ceilings, architectural mouldings, and subtle period detailing.
- Warm, directional courtroom lighting with a slightly theatrical falloff.
- A clear floor area where the two advocates face one another.
- A readable front edge or rail that separates the judge's bench from the advocates.

The Japanese-inspired and British-inspired judicial characters can coexist in this fictional, stylized courtroom universe. The architecture may be predominantly Victorian British in atmosphere, while the two reference characters retain distinct visual heritage. The third judge should harmonize with both without becoming a pastiche.

**Avoid:** excessive clutter, tiny ornamental details that disappear at demo scale, constant smoke/dust effects, busy textures behind text, or an environment so dark that the characters and messages become hard to see.

### 5.2 Palette proposal

The palette is a design recommendation, not yet a separately approved brand system.

| Token | Suggested value | Use |
|---|---:|---|
| Ink / near-black | `#211B19` | Deep text, shadows, dark framing |
| Walnut | `#30221D` | Main dark wood |
| Mahogany | `#533427` | Bench, panelling, stage |
| Oxblood | `#6A3038` | Velvet, active-case accents |
| Antique brass | `#B18B53` | Decorative metal, small highlights |
| Parchment | `#E8DDC8` | Docket paper, warm light surfaces |
| Chalk | `#F4EFE5` | High-contrast light text surfaces |
| Muted sage | `#71806A` | Secondary success/accepted status |
| Muted red | `#A84D45` | Objection/rejection status |

Use semantic colours sparingly. Accepted, contested, rejected, and pending states must also have text labels or icons; never communicate status through colour alone.

### 5.3 Surface and texture treatment

- Use real illustrated wood and fabric textures in the stage background, but keep them low contrast.
- Use parchment-like surfaces for docket cards and verdict documents.
- Give the 25% Switch chat column a much cleaner, flatter surface so it remains legible and looks like a real collaboration tool.
- Use brass lines, thin borders, and small ornamental separators as accents.
- Avoid placing ornamental frames around every single UI component.
- Keep the plan and chat readable even when the courtroom background is animated.

### 5.4 Typography proposal

Use a deliberate contrast between ceremonial display type and functional interface type.

- **Display / case titles:** expressive, legible serif. Candidates to test: `Cormorant Garamond`, `Source Serif 4`, or `Libre Baskerville`.
- **Interface / controls / messages:** neutral sans serif. Candidates to test: `Inter`, `Manrope`, or `IBM Plex Sans`.
- **Technical metadata / timestamps / event labels:** monospace sparingly, e.g. `IBM Plex Mono`.

Do not use a highly ornamental Victorian font for long dialogue, Switch chat, or docket details. The live transcript must remain effortless to scan.

---

## 6. Character system

### 6.1 Three judges

All three judges must:

- Be full-body, hand-drawn game-art characters.
- Sit together on one elevated bench, with equal size and visual importance.
- Share the same illustration technique, shading, outline weight, level of detail, and scale.
- Have distinct silhouettes and readable poses.
- Have individual animation rigs or sprite-state sets.
- Remain visually stable across idle, listening, thinking, speaking, accepted, rejected, and narrowed states.

**Judge 1 — Empire of Japan-inspired judicial reference**

Use the *Great Ace Attorney Chronicles* Empire of Japan Judge concept as an art-direction reference. Develop an original character design and costume. Preserve the broad idea of a distinct judicial identity, but do not trace, reproduce, or directly adapt the game artwork.

**Judge 2 — British Empire-inspired judicial reference**

Use the British Empire Judge concept as a second art-direction reference. Develop a separate original character with a complementary but distinct silhouette and period judicial styling. Do not copy the exact character, costume, sprite, or facial design.

**Judge 3 — Original woman judge**

Design an original woman judge in the same illustrated universe. She must be as visually substantial and authoritative as the other two—not a smaller side character or a decorative addition. Her clothing, pose, and silhouette should feel coherent with the courtroom's period-inspired visual world while giving her a distinct identity.

**Role assignment remains configurable:** Fairness, Feasibility, Cost. Do not imply that a character's gender or cultural inspiration determines their judging role.

### 6.2 Advocate identities

The left and right advocates are not human lawyers. They are the logos/marks of the AI models or providers used by each owner.

- **Left:** Advocate H — Harshil's configured model/provider (example: GPT/ChatGPT).
- **Right:** Advocate D — Daksh's configured model/provider (example: Claude Code).
- The provider/model name and owner name should be shown in a small nameplate.
- The correct mark should be loaded from an approved, high-quality asset source.
- Keep each trademark artwork intact and recognizable. Do not redraw it as a face, add eyes/mouth/arms, stretch it, recolour it, crop it, texture it, or bake it into a new logo.
- Make the logo feel like a character through the **surrounding scene**: its own advocate's lectern/platform, spotlight, position, nameplate, speaker indicator, and environmental animation.
- During speaking, animate the surrounding spotlight, subtle platform movement, or a waveform/active ring around the mark rather than distorting the mark itself.
- Allow the configured provider/model to change without redesigning the courtroom layout.

Use provider marks only to identify the actual service/model being used, follow each provider's own current brand rules, and avoid implying sponsorship or official endorsement. The OpenAI guidelines specifically prohibit distorting or adding effects/textures to its marks; check Anthropic and any other provider's current trademark guidance as well.

---

## 7. Motion and character state system

Motion intensity is **balanced**. Motion must communicate who is acting and what the court has decided; it should not run continuously just to decorate the screen.

### 7.1 Judges' animation states

| State | Visual behavior | Trigger |
|---|---|---|
| Idle | Subtle breathing, occasional blink, small posture shift, restrained paper movement | No active event |
| Listening | Eyes/head turn toward the active advocate; stillness otherwise | Incoming statement or proposal |
| Thinking | Look down to notes, brief pause, hand-to-chin or comparable gesture | Evaluation begins |
| Speaking | Small mouth/face change and a controlled hand gesture; no exaggerated flailing | Judge commentary/ruling text is emitted |
| Accept | One clear nod; subtle warm highlight on that judge's role marker | Perspective accepts |
| Reject | Controlled head shake or firm hand gesture; restrained red status accent | Perspective rejects |
| Narrow | Lean forward or raise hand to qualify a proposal | Perspective requests a narrower version |

### 7.2 Advocate animation states

| State | Visual behavior | Trigger |
|---|---|---|
| Idle | The logo remains intact; its lectern/environment has subtle ambient life | No active event |
| Thinking | Quiet pulsing indicator or restrained movement in the surrounding stage | Agent is processing, if this state is actually available |
| Speaking | Advocate spotlight becomes active; speech waveform or voice-like indicator; dialogue bubble/transcript updates | Agent message begins |
| Objection | Brief warm/red side-light and objection marker; do not alter the trademark art | Objection event |
| Accepted | Spotlight softens; acceptance marker appears | Proposal accepted |
| Rejected | Briefly dim the surrounding stage, show rejection marker | Proposal rejected |
| Waiting | Passive, stable listening state | Other participant has the floor |

Do not invent real-time “thinking” or “speaking” status if Switch does not expose it. Derive only from confirmed events or message activity. If a state cannot be confirmed, fall back to a neutral idle/listening presentation.

### 7.3 Three-judge ruling choreography

A proposal should produce one deliberate sequence:

1. Both advocates settle into listening/idle.
2. The three judges enter thinking state together or in a subtle stagger.
3. Each judge's perspective marker illuminates in turn as its assessment appears.
4. The clerk's combined ruling appears as a readable verdict banner or docket update.
5. Each judge transitions to accept, reject, or narrow based on its own result.
6. The docket card moves from Contested to Agreed, Rejected, or remains Open.
7. Advocates return to idle/listening.

The panel should not look like three unrelated characters firing random animations. The sequence must be coordinated and driven by a single ruling/event identifier.

### 7.4 Signature moments

Limit the experience to a few memorable moments:

- The opening camera move into the courtroom.
- A judge's coordinated ruling sequence.
- The objection moment.
- The final verdict.
- The deadlock/appeal moment.

Use quick functional micro-interactions for smaller events. Avoid scroll hijacking, autoplaying sound, long unskippable animation, or motion that makes reading difficult.

### 7.5 Suggested animation implementation

Rive is a candidate because its official feature set includes state machines, transitions, listeners, and event/data-binding support. It is not mandatory. Inspect the existing project stack and asset pipeline first.

Possible approaches:

- **Preferred if the art pipeline supports it:** hand-drawn layered character artwork rigged into reusable state machines.
- **Fallback:** hand-drawn sprite sequences or a small set of transparent character poses with CSS/JS transitions.
- **Camera intro:** layered 2D parallax and timeline-controlled camera transform; use GSAP or the existing animation library if the repository already includes one and the effect warrants it.

Do not introduce multiple animation libraries for overlapping jobs. Confirm licensing, bundle size, runtime performance, and how quickly the team can produce usable assets before choosing.

---

## 8. Hero introduction: separate cinematic entry

The intro is a separate experience before the working courtroom. It must lead into the workspace, not replace it.

### 8.1 Storyboard

**Opening beat — The case is called**

- Begin on a dark, nearly silent view of the courtroom exterior/interior threshold or a closed courtroom door.
- Display a concise case heading, e.g. `THE PEOPLE v. THE PLAN` (working title; final copy is not fixed).
- Use a small docket/case number detail for atmosphere.

**Camera enters**

- The camera-like view pushes through the courtroom entrance or advances down the central aisle.
- Reveal the elevated judicial bench first.
- Use layered 2D artwork/parallax to create depth; do not imply a full 3D scene unless one is deliberately built.

**Reveal the judges**

- Settle on the three full-body judges together on the bench.
- Give each a short, restrained entrance/idle gesture.
- Their role labels can appear as the camera settles.

**Reveal the advocates**

- Camera drifts/widens to reveal the two advocate positions on opposite sides.
- Their model/provider logos remain intact in their advocate settings.
- Names/owners appear on their respective nameplates.

**Establish the whole court**

- Finish on a wide composition that shows the judges above, advocates facing each other below, and the courtroom architecture around them.
- Display one clear action: `Enter Court` / `Begin Proceedings`.
- Provide `Skip intro` throughout.

### 8.2 Timing and control

- Target a short, deliberate sequence—approximately 5–8 seconds before the final call to action, not a long cinematic trailer.
- The user can skip immediately.
- Do not autoplay sound. If sound is later added, it must be off by default and have visible controls.
- Respect `prefers-reduced-motion`: replace camera travel with a static composition and short crossfades.
- Do not replay the entire introduction on every small navigation change. Provide a replay control if useful.

### 8.3 Transition into the working view

The transition should feel like entering the live hearing: the final wide courtroom composition settles into the workspace's 75% stage column while the 25% Switch chat panel appears alongside it. Keep the transition short and avoid blocking the actual trial.

---

## 9. Working courtroom: desktop layout

### 9.1 Overall split

At desktop widths, target a persistent **75% courtroom / 25% Switch chat** split.

- Left/main column: 75% of the available application width.
- Right column: 25% of the available application width.
- Use `min-width` constraints so the chat column does not become unusably narrow. If the viewport is too small to maintain a readable 25% chat panel, transition to the responsive behavior in Section 12 instead of compressing both columns.
- Keep the right panel visible during the main trial, rulings, and verdict.

### 9.2 Main courtroom column

Recommended vertical hierarchy:

1. **Case header:** case title, round counter, current phase, connection/case state.
2. **Courtroom stage:** judges on the upper/elevated bench; advocates on the lower floor facing one another; active speaker cue and current dialogue.
3. **Persistent docket:** a structured docket below the stage, showing plan items and their statuses.

The main stage is the visual centrepiece. It must not become so dense that the 3 judges and 2 advocate marks become tiny.

### 9.3 Courtroom composition

- Three judges occupy the upper central bench, equal size and equal prominence.
- Advocate H occupies the lower left.
- Advocate D occupies the lower right.
- Both advocates face inward toward the opposing advocate and the judicial bench.
- Use a visual centreline and courtroom architecture to connect the composition.
- Dialogue should appear in a readable dialogue area near the stage, not as a huge bubble covering the judges or advocates.
- Show the active speaker clearly, but avoid having every speaker card permanently compete for attention.

### 9.4 Dialogue presentation

- The actual text of statements/proposals/objections must remain available in a readable transcript or current-message area.
- Use a restrained speech panel or caption strip to connect a real message to the active advocate.
- Preserve speaker name, owner/model, message text, and round context.
- Long messages should truncate in the stage with an affordance to expand/read the complete text; never discard the original message.
- Use plain language labels such as `Opening statement`, `Proposal`, `Objection`, `Ruling`, or `Appeal` where the event type is known.

### 9.5 Docket below the stage

The user selected a **persistent docket**.

Each plan item should show:

- Item title.
- Short description or current wording.
- Current status: Contested, Under Review, Agreed, Rejected, or Awaiting Appeal.
- Last ruling/round, if present in event data.
- Optional owner/advocate attribution if grounded in the proposal event.
- Expand/collapse detail for full rationale and history.

Docket behavior:

- Items update in place when a `plan_update` or ruling event is received.
- Use a clear status change transition, not a large flying-card animation that obscures content.
- Keep recently changed items easy to locate.
- Preserve history: changing an item must not erase the sequence of proposals and rulings that produced it.
- If there are many items, allow the docket content to scroll independently without moving the overall courtroom stage or Switch panel.

### 9.6 Special case states

**Objection**

- Brief visual emphasis on the objecting advocate.
- Objection label and text are shown.
- The relevant docket item is highlighted if the event includes an item reference.

**Ruling**

- Judges perform the coordinated ruling sequence.
- The verdict text is legible and persistent in the docket/history.
- The corresponding item updates status.

**Deadlock**

- Use a clear, high-contrast `DEADLOCK` banner.
- Highlight the unresolved docket item.
- Preserve both advocates' positions and the judge's deadlock explanation.

**Appeal**

- Show an `APPEAL` banner that identifies both owners and what decision they are being asked to make.
- Human decision is explicit and attributable.
- Do not make the user guess which point is unresolved.

**Final verdict**

- A deliberate closing moment with a clear verdict heading.
- Show the final agreed plan and any human appeal decisions.
- Provide a way to inspect the decision history.

---

## 10. Right panel: Switch room chat (25%)

### 10.1 Product principle

The right panel is a chat-first, live view of the actual Switch room conversation. It is not a fake “agent activity” feed and must not be populated with hard-coded demo messages when the real connection is active.

Switch's current public materials describe it as connecting humans and AI agents through existing collaboration platforms, including Mattermost, Slack, Teams, Discord, and Telegram. Switch is not itself an agent provider or a replacement chat application. The exact UI/data path for embedding or mirroring a room inside this custom frontend must be verified in the running hackathon environment.

### 10.2 Panel hierarchy

**Header**

- Switch mark/name as appropriate, room name, connection status.
- Small participant count or room participant list affordance.
- A visible route/link to open the full room in its native chat application if configured.

**Conversation**

- Actual message sequence, chronological order.
- Speaker identity and role (Harshil/Advocate H, Daksh/Advocate D, Clerk, Judge, etc.).
- Original message body, preserving formatting to the level supported by the source platform.
- Timestamp or relative time.
- Clear visual separation between human, agent, and system/clerk messages.
- Scroll-to-latest behavior; if the viewer scrolls up, do not forcibly yank them to the bottom. Show an unread/new-message indicator instead.

**Composer / input**

- Do not add a custom message composer until a supported write path is verified.
- MVP may be read-only in the embedded panel, with a button to open the real room in Mattermost or the configured platform.
- If a supported send path is confirmed, a small composer may be added; messages must be sent into the actual Switch room, not a separate local chat store.

### 10.3 Connection states

- **Connected:** show a real connection indicator.
- **Connecting:** show that messages may be delayed.
- **Reconnecting:** preserve prior messages and clearly indicate stale/live status.
- **Disconnected:** show the last successful update time and a retry/open-native-room action.
- **Unavailable:** explain that the Switch room feed could not be reached; do not show fabricated real-time status.

Never display a green `LIVE` badge unless the client has a current connection or a recent heartbeat that the implementation can verify.

### 10.4 Integration investigation and fallback

The original project spec proposed two options:

1. Read room events through Switch's Gateway API.
2. Have the Clerk send structured JSON events to the frontend server.

The current public Switch repository includes a `gateway/` directory described as a management API for the frontend, but that fact alone does not prove which message-history/streaming operations are supported for the demo. Do not invent endpoint names or assume the public API provides arbitrary room-message access.

Recommended integration spike:

1. Inspect the current Switch version and docs used by the team.
2. Confirm how the actual room messages can be read and streamed to the frontend.
3. Confirm whether the existing Mattermost room can safely be embedded or whether a custom mirror is more reliable.
4. Verify authentication, CORS, iframe/security policy, and message ordering.
5. Confirm whether the front-end can send messages, or whether only read-only mirroring is practical.
6. Record the exact supported path in a small integration note before implementation.

**Fallback:** retain the Clerk JSON event bridge from the project spec for the courtroom animation and docket. This fallback supports the structured courtroom events, but it must not be described as a full raw-chat mirror unless it actually forwards the entire room conversation.

### 10.5 Why this panel matters to the demo

The 25% panel is not wasted space. It visibly proves that the courtroom is powered by Switch: two owners, their agents, the Clerk, and the shared room can be seen collaborating in the source communication surface while the larger stage translates selected events into courtroom actions.

---

## 11. User journey and information architecture

Preserve the functional flow from the project spec.

1. **Filing:** a case topic is created, e.g. `Plan our hackathon build`.
2. **Intake:** each owner gives their advocate constraints through the available routes (interview and profile file; calendar remains a stretch goal). Private details must remain in the owner's private room.
3. **Opening statements:** advocates disclose the constraints they choose to share.
4. **Motions and counter-motions:** advocates propose and challenge items. Start with a maximum of four rounds as in the spec.
5. **Judicial perspectives:** fairness, feasibility, and cost assessments are shown as the three judges' perspectives. The implementation must accurately represent whether they come from one or multiple judge agents.
6. **Clerk ruling and plan update:** the Clerk records the ruling and updates the docket.
7. **Verdict:** when all items are resolved, publish the final plan.
8. **Deadlock and appeal:** unresolved items after the round limit go to the two owners for a human decision.

The frontend must preserve this as one coherent journey. Avoid turning the intro into a setup wizard or requiring users to configure multiple panels before seeing the courtroom work.

---

## 12. Responsive behavior

### Desktop (primary demo target)

- Maintain 75/25 split when viewport size permits.
- Keep the Switch chat visible and usable.
- Keep all three judges and both advocates visible without scrolling the stage.
- Docket sits below the stage and can scroll/expand independently.

### Tablet / compact desktop

- Preserve the courtroom as the primary area.
- Reduce ornamental detail and whitespace before shrinking character art.
- If 25% becomes too narrow for messages, allow the chat panel to become a collapsible side drawer or tab.
- Do not let the chat overlap judge faces or advocate marks.

### Mobile

- Do not attempt to force a 75/25 split into a narrow viewport.
- Show a compact courtroom view first, with a `Court` / `Switch Chat` tab or drawer.
- Allow the Switch conversation to occupy the full mobile viewport when opened.
- Keep docket accessible as a bottom drawer or separate tab.
- Ensure the hero intro remains skippable and its camera move is replaced under reduced motion.

The primary judging demo should be tuned for desktop, but no critical content may disappear on mobile.

---

## 13. Accessibility and usability requirements

- Respect `prefers-reduced-motion` for the intro, characters, transitions, and docket animations.
- Do not rely on animation alone to communicate a state change; keep visible textual labels.
- Provide keyboard access to skip intro, open/close details, navigate docket items, and switch between Court and Chat on mobile.
- Ensure visible focus states and adequate contrast for text over dark wood/velvet backgrounds.
- Do not put small essential text directly over busy illustrated backgrounds.
- Provide accessible labels for judge roles, advocate names, current speaker, connection status, and verdict states.
- Keep a text alternative/transcript for all dialogue and rulings.
- Do not autoplay sound. Any future sound effects must be user-controllable.
- Keep controls comfortably sized for pointer and touch interaction.

---

## 14. Event-to-interface mapping

The project spec's draft event types should remain the source vocabulary:

`statement | proposal | objection | ruling | plan_update | deadlock | appeal | verdict`

| Event | Courtroom response | Docket response | Switch/chat response |
|---|---|---|---|
| `statement` | Activate relevant advocate; show dialogue | No status change unless linked to an item | Show original message |
| `proposal` | Activate proposing advocate; show proposal | Create/update Contested item | Show original message |
| `objection` | Objection state on objecting advocate; restrained red emphasis | Highlight relevant item | Show objection message |
| `ruling` | Coordinate three judges' perspective animations; show consolidated ruling | Update item status | Show judge/Clerk explanation if posted |
| `plan_update` | Brief highlight on docket area | Update the relevant item(s) | Show Clerk update if posted |
| `deadlock` | Deadlock banner; judges enter unresolved state | Mark item Awaiting Appeal | Show deadlock message and owners mentioned |
| `appeal` | Appeal banner; return focus to the humans | Mark decision pending, then record appeal outcome | Show owners' actual decision messages |
| `verdict` | Final verdict sequence | Freeze/publish final plan state while preserving history | Show final verdict message |

The current draft schema in the spec is:

```json
{
  "type": "statement | proposal | objection | ruling | plan_update | deadlock | appeal | verdict",
  "speaker": "...",
  "text": "...",
  "plan_diff": {},
  "round": 1,
  "ts": "..."
}
```

This is a draft, not a validated API contract. The implementation team should verify and formalize it. Suggested optional fields to discuss—not assume as already supported—include `event_id`, `case_id`, `item_id`, `judge_perspective`, `decision`, `status`, and `owner_id`.

Use stable event IDs or another deduplication strategy so reconnects do not replay the same gavel/character animation repeatedly. Store the last processed event cursor where the transport permits it.

---

## 15. Asset production plan

### Must-have assets

1. One illustrated courtroom background (wide composition, layered where possible).
2. One elevated judicial bench / bench overlay, if not baked into the background.
3. Three original full-body judge illustrations with transparent backgrounds.
4. Judge animation states or rig layers for idle, listening, thinking, speaking, accept, reject, and narrow.
5. Two advocate mark assets, using the actual configured providers and correct approved files.
6. Two advocate lecterns/platforms/nameplates.
7. Status insignia: Contested, Under Review, Agreed, Rejected, Awaiting Appeal, Deadlock, Appeal, Verdict.
8. A small set of cinematic intro layers (foreground, midground, background, lighting overlays).

### Asset constraints

- Design judge characters at a sufficiently high native resolution to remain crisp in the stage.
- Use transparent backgrounds for characters so the stage can be composed responsively.
- Keep judge body proportions and baseline height consistent.
- Keep idle and action poses visually consistent so transitions do not jump.
- Use original Delegates artwork. Treat the game references as direction only.
- Keep logos as separate original mark assets; do not use generated or improvised variants.
- Name assets by role and state, not by arbitrary export sequence.

Suggested asset naming pattern:

```text
courtroom/background/base
courtroom/background/foreground
courtroom/bench/overlay
judges/fairness/idle
judges/fairness/listen
judges/fairness/think
judges/fairness/speak
judges/fairness/accept
judges/fairness/reject
judges/fairness/narrow
advocates/harshil/provider-mark
advocates/daksh/provider-mark
advocates/harshil/platform
advocates/daksh/platform
```

The role-based folder names are placeholders until the three-character-to-role mapping is approved.

---

## 16. Implementation handoff

### Repository / stack status

The supplied project spec does not identify the frontend framework, package versions, current animation dependencies, or current repository component structure. Treat the stack as **unverified until the coding agent inspects the actual repo**. Do not assume a framework or add dependencies before inspection.

### Suggested build order

**Phase 1 — Static composition first**

- Build the separate intro screen and the 75/25 workspace layout.
- Use temporary art placeholders with the correct dimensions.
- Establish stage, bench, advocates, docket, and Switch panel regions.
- Verify layout at desktop, tablet, and mobile sizes.

**Phase 2 — Character art and state transitions**

- Integrate the three judge illustrations and two advocate marks.
- Implement idle/listening/thinking/speaking/decision states.
- Wire animations to deterministic mock events first.
- Verify that animation can be disabled or reduced.

**Phase 3 — Real Switch room panel**

- Spike the true message retrieval/streaming path.
- Connect the right panel to actual room messages if a supported path exists.
- Clearly expose connection/reconnection state.
- Retain a native-room escape hatch.

**Phase 4 — Docket and case flow**

- Connect proposal, objection, ruling, plan update, deadlock, appeal, and verdict events.
- Confirm event ordering and duplicate handling.
- Preserve the original message and decision history.

**Phase 5 — Visual polish and demo rehearsal**

- Tune the camera intro and transitions.
- Add the coordinated judge ruling sequence.
- Verify the three-minute demo flow from the project spec.
- Capture screenshots/video at the target demo resolution.

### Do not overbuild

The project spec explicitly identifies animation scope as a risk. Prefer a small, reusable state set and a convincing courtroom composition over dozens of unique animations. The hero intro and one strong ruling/appeal sequence should carry the emotional weight.

---

## 17. Acceptance criteria

### Art direction

- [ ] Courtroom reads immediately as a grand Victorian-inspired courtroom.
- [ ] The illustration style is hand-drawn game art, not generic vector mascot art.
- [ ] The Japanese-inspired and British-inspired judge references are adapted into original artwork.
- [ ] The third judge is an original woman character in the same visual universe.
- [ ] All three judges have equal prominence and sit together on one elevated bench.
- [ ] Two advocates are recognizable provider/model marks, not human lawyer characters.
- [ ] Provider logos remain intact and follow each brand's current usage guidance.

### Hero intro

- [ ] Intro is a separate screen before the workspace.
- [ ] Camera-like movement reveals the courtroom and its participants.
- [ ] `Skip intro` is available immediately.
- [ ] Reduced-motion mode uses a static/short-transition alternative.
- [ ] Entering the court transitions into the 75/25 workspace.

### Main workspace

- [ ] Desktop layout is 75% courtroom and 25% Switch chat when space permits.
- [ ] Judges, both advocates, current dialogue, and case state remain readable.
- [ ] Docket persists below the courtroom stage.
- [ ] Docket statuses visibly update as decisions are made.
- [ ] Deadlock, appeal, and verdict have distinct readable states.

### Switch integration

- [ ] The right panel displays actual room messages when in connected mode.
- [ ] It does not show hard-coded sample messages as if they were live.
- [ ] Connection and stale/disconnected states are truthful.
- [ ] It is clear which agent/person sent each message.
- [ ] A native room open action is available where configured.
- [ ] The exact message data path is documented and verified.

### Motion and accessibility

- [ ] Judge and advocate states are driven by events, not arbitrary timers.
- [ ] Duplicate events do not repeatedly trigger the same animation.
- [ ] State meaning is also available as text.
- [ ] Keyboard navigation, visible focus, contrast, and reduced motion are tested.
- [ ] No critical content depends on sound or animation.

---

## 18. Open questions / decisions deliberately not made

These points should remain open until a short implementation spike or a deliberate design decision resolves them:

1. **Judge backend topology:** three separate judge agents or one judge agent producing three perspective assessments.
2. **Judge-role assignment:** which of the three illustrated characters embodies Fairness, Feasibility, and Cost.
3. **Switch message source:** exact supported mechanism for reading/streaming the live room conversation into the custom panel.
4. **Switch panel write access:** whether the custom panel sends messages to Switch or remains read-only with a native-room link.
5. **Exact framework and animation dependency:** inspect the actual repository before selecting or installing anything.
6. **Final palette and font pairing:** use the proposals above as a starting point and validate with a first rendered screen.
7. **Final case-title copy and intro sound design:** keep sound off by default; title copy can be finalized for the demo.

---

## 19. Instruction to the coding agent

Implement the approved direction as a working frontend, not as a static mockup. Preserve the project’s existing architecture and working functionality. Inspect the repository before changing dependencies or choosing animation tooling.

First build the representative desktop screen: separate cinematic intro, followed by the 75/25 live courtroom workspace. Use the hand-drawn Victorian courtroom direction, three equally prominent full-body judges on an elevated shared bench, two actual provider/model logo advocates facing each other, a readable current-dialogue region, a persistent docket below the stage, and a chat-first Switch panel on the right.

Use temporary placeholders where original character artwork or verified Switch data is not yet available. Label placeholders clearly. Do not invent real connection status, messages, endpoint names, judge-agent topology, or live agent states. Wire a deterministic mock event stream first, then replace it with the verified Switch integration. Keep the original event vocabulary from the spec and preserve full message/decision history.

Prioritize composition, visual hierarchy, event truthfulness, responsive behavior, and a reliable three-minute demo journey. The courtroom should be memorable; the actual Switch collaboration must remain visible and real.

---

## 20. Research links

- [Jury Trial — Loge Games](https://loge-games.itch.io/jury-trial)
- [The Great Ace Attorney Chronicles — Empire of Japan Judge concept art gallery](https://creativeuncut.com/art_the-great-ace-attorney-chronicles_c.html)
- [The Great Ace Attorney Chronicles — British Empire Judge concept art gallery](https://www.creativeuncut.com/art_the-great-ace-attorney-chronicles_b.html)
- [Aviary Attorney — Official press kit](https://www.aviaryattorney.com/press.html)
- [Rive — Features and state machines](https://rive.app/features)
- [Rive — Editor](https://www.rive.app/editor)
- [Switch — Getting Started](https://www.switchagents.ai/blog-posts/switch-getting-started)
- [Switch — Documentation](https://docs.switchagents.ai/)
- [Switch — GitHub repository](https://github.com/sandbox-quantum/switch)
- [OpenAI — Design Guidelines](https://openai.com/brand/)
- [Anthropic — Legal and trademark resources](https://www.anthropic.com/legal)

