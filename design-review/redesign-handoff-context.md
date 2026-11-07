# Delegates courtroom: judge redesign context

The request is to **redesign the three judge characters only**, using the supplied
references and the owner’s feedback. The intro sequence and dashboard are context
for where the characters appear, not redesign targets for this task.

Delegates is a hackathon project about two people whose AI advocates negotiate a
shared plan. Harshil’s advocate is GPT; Daksh’s is Claude. Their debate takes place
in a courtroom, a judicial panel assesses the proposals, and a clerk maintains the
evolving agreement. Disagreement can reach a deadlock and return to the humans
for a decision. The aim is a memorable courtroom performance with an understandable
conversation and plan, rather than an ordinary AI dashboard with decoration.

## Where the design stands

The owner likes the current cinematic intro sequence. The actual dashboard has
not been approved. The immediate discussion concerns the judge artwork, which
has repeatedly fallen short of the supplied references.

The first character pass used hand-coded SVG figures. They looked generic and
did not capture the Japanese and British judge references. The next pass extracted
the exact reference figures and put them into the courtroom. The woman combined
a new vector face with a recoloured reference costume. This was also rejected:
it looked like pasted cutouts, not a redesigned, coherent illustrated scene.

The owner’s latest feedback:

> “Literally did nothing. Just pasted those pictures exactly as they are. It's
> just looking like a cutout. I asked you to redesign it not to just paste the
> exact PNGs over there. It looks so fucking awful.”

Earlier, the owner said:

> “I specifically like the intro sequence not the actual dashboard yet. The
> cinematic intro is good … The judges design should be as close as possible
> to the references that I gave you, like the Japanese judge and everything.”

The owner initially said direct reuse would be acceptable, but the resulting
literal cutout treatment was rejected. The desired outcome is an actual visual
redesign with the reference’s character and quality, not that failed treatment.

This handoff is intended to give a fresh model the context and references to
exercise its own design judgment on the judges. The previous assistant’s workflows, rules,
step-by-step plans and design prescriptions are not included.

## General creative direction

The established idea is a theatrical, traditional Victorian-inspired courtroom
with hand-drawn courtroom-adventure-game art. The Japanese judge and British
judge from The Great Ace Attorney Chronicles are the main character references.
There is also a woman judge in the same illustrated world. The envisioned panel
has three equally prominent full-body characters seated together at an elevated
bench. Their personalities, faces, clothing, physical presence and visual finish
matter much more than generic “judge” symbols.

The intended judicial perspectives are Fairness, Feasibility and Cost. No mapping
between those roles and the three character appearances has been selected. These
are evaluative perspectives, not three AI-provider brands. GPT and Claude are the
advocates and are currently represented by their provider marks.

The wider workspace idea has a large courtroom on the left, a conversation on the
right, and a persistent docket beneath the courtroom. The prior brief described
a 75/25 desktop split. This is background to the product, not approval of the
current dashboard rendering. The separate cinematic arrival is the part the owner
has specifically praised.

## What currently works

The application is a local, scripted frontend, not a connected Switch room. Its
hearing has playback, pause, manual advance, speed selection and restart. It
shows proposals, objections, assessments and rulings; maintains current plan
wording and decision history; reaches a deadlock after four rounds; offers a
sample joint human appeal; and exports the plan and hearing record. Smaller
screens have Court, Chat and Docket tabs. There is keyboard navigation and a
reduced-motion path. The intro has four camera beats, immediate skip and replay.

There are currently no live provider calls from this frontend. No hosted release
has been made. Work has been local on the `harshil-dev` branch of
https://github.com/harshil-sri/delegates, with the backend outside this design pass.
The owner’s operating context has been no paid calls, purchases or new accounts.

## Contents of this archive

- `frontend/`: the current working frontend source, local server and static build.
  This includes both the latest rejected reference-cutout artwork and earlier
  rejected original SVG studies, so the current state is fully visible.
- `references/`: the supplied visual reference images, including Japanese and
  British character sheets, their additional concepts, and courtroom imagery.
- `screenshots/current/`: the current implementation, including the rejected
  cutout pass, mobile views and the liked cinematic intro beats.
- `screenshots/earlier-rejected/`: the earlier rejected dashboard and character
  presentation, included only as historical context.
- `test/`: existing frontend tests and browser checks.
- `verification/`: the latest machine-readable results. Passing functional tests
  have never meant that the owner approved the visual design.
- `package.json`: the existing project manifest. Some scripts reference backend
  files outside this frontend-focused archive.

For local inspection, the existing frontend starts with `node frontend/server.mjs`
on http://127.0.0.1:4173/ and builds with `node frontend/build.mjs`. It uses Node ESM
and no runtime framework dependencies. Browser test tooling was kept outside the
repository, so those runners are not standalone installations in this archive.

## Reference provenance

The Japanese and British judge sheets are The Great Ace Attorney Chronicles
artwork © CAPCOM, obtained from the supplied Creative Uncut links:

- https://www.creativeuncut.com/gallery-47/tgaac-empire-of-japan-judge.html
- https://www.creativeuncut.com/gallery-47/tgaac-empire-of-japan-judge-concept.html
- https://www.creativeuncut.com/gallery-47/tgaac-british-empire-judge.html
- https://www.creativeuncut.com/gallery-47/tgaac-british-empire-judge-concept.html

The Victorian courtroom photo is from the National Justice Museum. Other scene
references include official PlayStation imagery for The Great Ace Attorney
Chronicles and Aviary Attorney imagery. These are design-reference materials;
their inclusion and the owner’s willingness to preview them locally do not
establish a public distribution license. The current cutout assets are explicitly
reference-derived, not original Delegates artwork.
