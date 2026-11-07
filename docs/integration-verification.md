# Frontend-Backend Integration Verification

## Overview
The integration is based on Daksh's `judges-redesign` commit `e36ca55`, which
already includes the backend from `main`. Local checks use the actual SQLite
engine, backend HTTP service, frontend proxy and Chromium, with isolated synthetic
identities. They do not contact a real Switch room or invoke an advocate model.

**Integrated application:**
- Frontend: Custom Node HTTP server (`frontend/server.mjs`) on port **4173** (default).
- Backend: Read-only API at `127.0.0.1:CVC_COURT_PORT` (default **18802**).
- Proxy: Server in `frontend/server.mjs` routes `/api/*` to backend (same-origin, no CORS change needed).
- Live entry: `/court.html` (not auto-navigated; requires explicit Enter/Skip from intro).
- Modes: Recorded rehearsal via `/court.html?replay=1`; fallback to replay on 502/network error.
- The earlier scripted hearing is available separately at `/?demo=1`.
- Backend CORS: Default origins `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:3000`, `http://127.0.0.1:3000` (see `src/court-http.mjs`).

---

## Integration Boundaries

### Frontend (`frontend/server.mjs`)
- Static files from `frontend/public/`.
- Proxy: `/api/*` → `127.0.0.1:18802` (8s timeout → 502 if backend unreachable).
- No Vite; no `vite.config.mjs`.

### Backend (`src/court-http.mjs`)
- Read-only: `GET`/`HEAD` only; rejects other methods with `405`.
- Loopback-only: Requires `Host: localhost:18802` or `127.0.0.1:18802`.
- CORS: Configurable via `CVC_FRONTEND_ORIGINS` (default: 5173/3000 on localhost/127.0.0.1).

### Modes
| URL | Behavior |
|---|---|
| `/court.html` | Live mode (connects to backend via `/api` proxy). |
| `/court.html?replay=1` | Recorded rehearsal (no backend; uses `/data/replay-signal.json`). |
| Fallback | On 502/network error, live mode falls back to replay. |

---

## Test coverage

### Existing Tests
- `test/frontend-hearing.test.mjs`: Scripted hearing reducer and event logic.
- `test/frontend-server.test.mjs`: Static server security and headers.
- Existing backend suites cover identity/consent, bounded negotiation, persistence,
  source replay, failed room polling, immutable bundles and tamper-proof receipts.

### Added integration regressions
- `test/frontend-proxy.test.mjs`: Actual engine + proxy, read-only methods,
  Host/Origin protection, export gating/exact bytes, SSE, disconnects and timeouts.
- `test/court-sse.test.mjs`: Initial cursor, missed beats, no-event reconnect,
  ingestion changes, stream limits, heartbeat and dynamic-port Host checks.
- `test/court-command-stage.test.mjs`: Approval-command gating during recess,
  signature collection, approval, revocation and invalidation.
- `test/frontend-live-browser.mjs`: Browser E2E (requires `QA_MODULES` + `CHROMIUM_EXECUTABLE`).

---

## Verification gates

- [x] Backend + proxy tests run against actual ephemeral HTTP servers.
- [x] SSE and approval-state regressions pass; independent backend/proxy review
  reports no remaining blockers.
- [x] Final combined unit, syntax and build checks after all client fixes.
- [x] Final browser E2E, retry recovery, legacy demo and intro regression checks.

Final independent runs: **113/113 Node tests twice**, **16/16 integrated browser
checks**, **22/22 legacy browser checks**, and **3/3 additional intro checks**.
The 42 frontend unit tests are already part of the 113, not additional tests.
Syntax and static build passed. Desktop/mobile live-view axe audits and the
legacy audit set reported zero violations; no unexpected browser console or
network errors were reported. These are automated checks, not a claim of
exhaustive accessibility or real-room approval.

Machine evidence: `integration-release-results.json` (repeatability, syntax,
build and live browser), `integration-legacy-verification.json` (independent
legacy checks), `frontend-live-browser-results.json`, `frontend-browser-results.json`
and `frontend-v11-browser-results.json`. Settled desktop/mobile, storyboard,
recess and approved-export screenshots are in `design-review/integration/`.
The case-file reveal panels were scrolled into view and checked for actual
visibility, not just text present in hidden DOM.

Both backend/proxy and final client source reviews found no remaining release
blockers. Earlier local failures (an incorrectly bound legacy test server and
replay retry lifecycle) were corrected and superseded by these final runs.

---

## Known Boundaries

1. **Live services unavailable here**: Docker is installed but no Switch/Mattermost
   containers or ignored `.runtime` room configuration are present. Port 18802
   did not answer the initial health check. A real room/provider rehearsal is
   unverified, not replaced by the local synthetic test results.
2. **No Paid Model Calls**: Advocate turns require Codex CLI + provider credentials (not authorized here).
3. **Static Build**: `npm run build` produces `dist/` but cannot proxy API standalone (requires backend).
4. **Frontend Read-Only**: No approvals via HTTP; all decisions in Switch room.
5. **Backend Read-Only**: `GET`/`HEAD` only; writes via Switch room messages.

---

## Commands

```bash
# Frontend
node frontend/server.mjs          # Port 4173 (default)
PORT=4174 node frontend/server.mjs # Custom port

# Backend (requires .runtime/ configs)
node scripts/listen.mjs           # Start listener
npm run setup:engine             # Initialize engine

# Tests
npm run test:frontend            # Frontend unit/integration
npm test                          # Backend, frontend and integration regressions
npm run check                    # Syntax, including live courtroom modules
npm run build                    # Static assets; does not supply a backend proxy
npm run test:integration          # Focused HTTP proxy/engine checks

# Browser E2E (requires QA_MODULES + CHROMIUM_EXECUTABLE)
QA_MODULES=/tmp/opencode/delegates-qa/package.json \
  CHROMIUM_EXECUTABLE=/path/to/chrome \
  node test/frontend-live-browser.mjs
```
