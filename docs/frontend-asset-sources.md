# Frontend Asset Sources and Verification

## Current assets (supersedes everything below)

- **Judges:** original Delegates artwork drawn in code in `frontend/public/judges.mjs`
  (Justice Sōjirō Arata, Justice Imani Vale, Lord Justice Barnaby Thorne). No
  third-party character art is shipped. The Capcom reference cutouts, the
  reference sheets, the extraction script and `delegates-redesign-context.zip` were
  removed from the repository tree.
- **Advocates:** pixel avatars in `frontend/public/avatars.mjs`. The Claude crab
  follows Anthropic's Claude Code mascot to identify that provider; the GPT and
  Codex mascots are original.
- **Fonts:** Boska and Switzer from Fontshare (ITF Free Font License), self-hosted;
  Cormorant Garamond and IBM Plex Sans under the OFL (licences in `fonts/`).
- **Motion:** GSAP 3.13 and ScrollTrigger, self-hosted in `frontend/public/vendor/`
  under the GSAP standard licence.
- **Storyboard art:** the project's own SVGs in `assets/`, copied to `frontend/public/storyboard/`.

## Superseded: earlier judge-only revision (historical, assets removed)

The user explicitly approved direct use of the supplied character references for
the local preview. Active art slots now load `japan-reference.svg`,
`british-reference.svg`, and `woman-reference.svg` in `frontend/public/art/panel/`.
The first two contain transparent extracts of **The Great Ace Attorney Chronicles
artwork © CAPCOM**, from the supplied Creative Uncut sheets:

- `https://www.creativeuncut.com/gallery-47/art/tgaac-empire-of-japan-judge.jpg`
- `https://www.creativeuncut.com/gallery-47/art/tgaac-british-empire-judge.jpg`

The woman combines a locally authored portrait and gold-edged teal mantle with a
recoloured British-reference costume. It is derivative study work, **not wholly
original character art**. All three SVGs include provenance metadata. The earlier
original vector studies remain intact but are no longer active.

These assets are for this local preview, not a grant of public-use rights. The
static build now contains these reference-derived assets too and must not be
published without resolving the rights or replacing them. No deployment occurred.

Reproduction: `python3 design-review/v1.1/prepare-judge-art.py` uses the existing
local Pillow, NumPy and SciPy installation, supplied reference sheets and woman
portrait template. It makes no network or model calls. SVGs embed PNG artwork;
head/body clips retain event-driven articulation. Internal `use` links and clip
IDs are namespaced separately for the intro and court scenes.

The historical original-art description below refers to the preceding pass.

This document records the provenance, download URLs, and verified file details for official brand and font assets used in the Delegates courtroom interface.

## 1. Brand Assets

### OpenAI Logo Mark
- **Destination:** `frontend/public/brands/openai.svg`
- **Source URL:** `https://chatgpt.com/cdn/assets/favicon.6a33781f61.svg` (official OpenAI/ChatGPT CDN; the source attribution comment is retained in the unmodified file)
- **Format:** SVG (unmodified official single Blossom logo mark)
- **File Size:** 4,381 bytes
- **SHA-256:** `2021463df9935dda89cef407aa564bced9d83b4f9b6ae8945d649e56676624f0`
- **Reference Diagram (archived outside public):** `assets/openai-blossom-spacing-diagram.svg` (`https://images.ctfassets.net/kftzwdyauwt9/3hUGLn3ypllZ0oa01qOYVq/28e8188e6f11b84c3e876569d492734f/Blossom_Light.svg`, 6,789 bytes, SHA-256 `01485e70cea6df8422f5abc643fbbd3c153442cc41da0e7d8e7451801ebf26e2`)

### Claude Spark Mark
- **Destination:** `frontend/public/brands/claude.svg`
- **Source URL:** `https://claude.ai/favicon.svg`
- **Format:** SVG (unmodified official Claude spark mark, `#D97757`)
- **File Size:** 2,558 bytes
- **SHA-256:** `b150888bc7257af83e3b85d3c2be4294f88986026f8168f6c12fc1fde6697350`

## 2. Self-Hosted Font Assets (WOFF2)

Stylesheet query used to resolve font binary endpoints:
`https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&family=IBM+Plex+Sans:wght@400&display=swap`

### Cormorant Garamond Regular
- **Destination:** `frontend/public/fonts/cormorant-regular.woff2`
- **Source URL:** `https://fonts.gstatic.com/s/cormorantgaramond/v21/co3umX5slCNuHLi8bLeY9MK7whWMhyjypVO7abI26QOD_v86KnTOig.woff2`
- **Subset:** Latin
- **Weight / Style:** 400 normal
- **File Size:** 22,876 bytes
- **SHA-256:** `8048ac209bec741e1c29cd0cfac5aac1c0c2ba8c3ddbd4a58fa9bd92ef5c63c2`

### Cormorant Garamond Italic
- **Destination:** `frontend/public/fonts/cormorant-italic.woff2`
- **Source URL:** `https://fonts.gstatic.com/s/cormorantgaramond/v21/co3smX5slCNuHLi8bLeY9MK7whWMhyjYrGFEsdtdc62E6zd58jD-iNM8.woff2`
- **Subset:** Latin
- **Weight / Style:** 400 italic
- **File Size:** 23,660 bytes
- **SHA-256:** `e48e58027030df56869b795ca6f19b7012158275f7ad7cde1900b4a0b68d02e2`

### IBM Plex Sans Regular
- **Destination:** `frontend/public/fonts/plex-sans.woff2`
- **Source URL:** `https://fonts.gstatic.com/s/ibmplexsans/v23/zYXGKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1swZSAXcomDVmadSD6llDB6g4.woff2`
- **Subset:** Latin
- **Weight / Style:** 400 normal
- **File Size:** 22,588 bytes
- **SHA-256:** `3b646991d30055a93a4ecc499713d4347953a74a947ecab435ab72070cbdab0e`

## 3. Font Licenses

### Cormorant Garamond OFL License
- **Destination:** `frontend/public/fonts/OFL-cormorant-garamond.txt`
- **Source URL:** `https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt`
- **License:** SIL Open Font License, Version 1.1
- **File Size:** 4,387 bytes
- **SHA-256:** `60700d351cac4650c51f3f9db318d2a420f8b45052dba2715eb5fec41f0f6956`

### IBM Plex Sans OFL License
- **Destination:** `frontend/public/fonts/OFL-ibm-plex-sans.txt`
- **Source URL:** `https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsans/OFL.txt`
- **License:** SIL Open Font License, Version 1.1
- **File Size:** 4,456 bytes
- **SHA-256:** `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da`

## 4. Original courtroom artwork

The active v1.1 scene uses `art/chamber.svg`, `art/chamber-foreground.svg`, and
three original transparent illustrations in `art/panel/`: `japan-inspired.svg`,
`woman.svg`, and `victorian-inspired.svg`. All were authored locally. The chamber
develops the reviewed architectural study with its stand-in figures removed;
the characters are a new coherent seated set, not those temporary figures or
the rejected judge assets. Head/body layers provide state motion; no copied game
character art is used. These are vector character studies, not final painterly
quality or user-approved final art. The existing original `seal.svg` is retained.

The rejected room and judge files remain unused historical assets. The reference
images under `design-review/v1.1/references/` are attributed private-review copies
only; they are not loaded by the application or copied to its build. No
image-generation service was available or called.

## 5. Trademark boundaries

OpenAI and Claude marks remain the property of their respective owners. They
identify fictional sample advocate configurations, not a live provider
connection, sponsorship, partnership, or endorsement. The marks are not
recolored, stretched, textured, or animated. The surrounding lectern and
lighting communicate speech. Font licenses do not grant rights to these marks.

Reference guidance: [OpenAI brand](https://openai.com/brand/) and
[Anthropic legal](https://www.anthropic.com/legal). Review current guidance
before public distribution or a future live integration.
