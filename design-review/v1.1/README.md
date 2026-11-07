# v1.1 visual review, not a finished frontend

## After “continue”

The running rebuild is now at **http://127.0.0.1:4173/**. The review on port 4174
is the historical Section 2A study, not the application. Current browser evidence
is in `implementation/`. The new room and three seated character studies replace
the rejected production presentation; the review's temporary figures are not used.
Final painterly artwork quality and art approval remain open. The implementation
is still explicitly offline, with no Switch integration or deployment.

## Original Section 2A review

Open the local review at **http://127.0.0.1:4174/** while its server is running.

Restart it from the project root with:

```sh
python3 -m http.server 4174 --bind 127.0.0.1 --directory design-review/v1.1
```

This directory began as the mandatory Section 2A pre-implementation study. At
that milestone the application was untouched; the backend remains untouched.
Do not deploy this pack:
`references/` contains attributed third-party images for private review only.

- `index.html`: visual reference sheet and storyboard.
- `workspace.html`: standalone 75/25 desktop composition.
- `character-lineup.png`: exact reference pair and unapproved woman rough.
- `desktop-composition.png`: new full-room layout study.
- `intro-storyboard.png`: four camera-framing studies.
- `woman-concept.svg`: original full-body ink-and-colour concept, not final art.
- `courtroom-composition.svg`: original spatial rough with temporary figures.
- `character-notes.md`: original costume direction, asset-production gate.
- `requirements.md`: section-by-section blueprint traceability and build map.

## Browser checks actually performed

Chromium, desktop 1440 × 900 and review-page mobile 390 × 844:

- Review page: three lineup images loaded, four storyboard frames present,
  no missing images, no horizontal document overflow at either size.
- Workspace study: left column 1080px, right outer column 360px (359px content
  plus 1px divider), no horizontal overflow at 1440px.
- Docket disclosure toggles correctly.
- No JavaScript page errors or failed HTTP responses during the isolated check.
- Desktop composition, character sheet, and storyboard screenshots were opened
  and visually inspected. The mobile review screenshot was captured but has not
  been visually inspected.

No production hearing regression suite or axe audit was run for this static
review milestone. No claims are made about final art fidelity, implemented
camera animation, live Switch integration, or completed responsive application
behaviour. Those remain subsequent gates.

## Provenance

R1/R2 reference images: Creative Uncut pages linked in `index.html`, original
artwork © Capcom. R4: National Justice Museum. R5: Aviary Attorney screenshot
via Thinky Games, official press-kit context. R6: Loge Games / itch.io. Official
R3 alternative: PlayStation/Capcom screenshot 06. The specific Nintendo Life
wide reference returned HTTP 403 and was not visually verified.

The OpenAI and Claude marks are unmodified copies of the existing official
source files documented in `docs/frontend-asset-sources.md`. Fonts are licensed
Cormorant Garamond and IBM Plex Sans; their OFL texts are included. Neither
the marks nor the references imply endorsement or a live provider connection.
