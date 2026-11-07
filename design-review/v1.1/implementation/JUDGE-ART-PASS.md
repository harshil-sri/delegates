# Judge-only reference pass

The user approved the intro sequence, withheld dashboard approval, and requested
much closer reference fidelity, expressly allowing direct use of reference art.
This supersedes the original-art-only instruction for this local art preview.

## Changed

- Japanese: supplied black cap, angular bearded face, broad near-black robe,
  ornate burgundy/gold mantle and gold gavel retained from the actual reference.
- British: supplied white curls and beard, spectacles, red/gold judicial robe,
  teal sash and gavel retained from the actual reference.
- Woman: new portrait, swept-up hair, earrings, teal/gold mantle and medallion,
  with recoloured reference costume for consistent painted folds and outline.
- Cleaned transparent cutouts, preserved source proportions, separate head/body
  layers and uniquely namespaced `use` references in both scenes.
- Truthful attribution in SVG metadata, accessibility labels, About and handoff.

## Preserved

No dashboard redesign, intro timing/storyboard change, CSS change, role mapping,
backend integration, paid generation, account creation or deployment. Earlier
artwork is retained. The new character art appears in the existing intro too.

## Evidence and limitations

`judge-art-lineup.png` shows the three full-body assets at a readable art-review
scale. `judges-reference-desktop.png` and `judges-reference-mobile.png` show their
actual placement. This is reference-derived local-preview art © CAPCOM, not a
claim of original artwork or public-use permission. The woman's face is still
vector drawn. Standing source poses have not become genuinely seated rigs.
Character-specific verdict expressions remain gated on approved role mapping.

The dashboard remains unapproved. This is a focused art iteration, not completion
of all remaining visual work.

Verification: 88 Node tests, 22 main browser cases and 3 intro/rig cases passed;
zero axe violations and resource errors. Syntax and static build passed. Viewed
the actual desktop/mobile court and full-size lineup. Same-origin SVG image
fallback decoded successfully; all 20 inline `use` references resolve to their
own namespaced definitions. AST-only graph refreshed. No test assertions changed
for this judge-only pass.
