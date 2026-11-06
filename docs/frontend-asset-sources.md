# Frontend Asset Sources and Verification

This document records the provenance, download URLs, and verified file details for official brand and font assets used in the Delegates courtroom interface.

## 1. Brand Assets

### OpenAI Logo Mark
- **Destination:** `frontend/public/brands/openai.svg`
- **Source URL:** `https://chatgpt.com/cdn/assets/favicon.6a33781f61.svg` (Official OpenAI/ChatGPT source originating from `openai/openai` repo `chatgpt/web/src/assets/favicon.svg`)
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
