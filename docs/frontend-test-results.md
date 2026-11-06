# Frontend Test Results

## Summary
- **Date**: Friday, November 06, 2026
- **Frontend Test Files**: `test/frontend-hearing.test.mjs`, `test/frontend-server.test.mjs`
- **Status**: ✅ ALL TESTS PASSING (Exit Code 0)

## Test Execution

### Frontend Unit & Integration Tests
Command:
```bash
NODE_OPTIONS='--max-old-space-size=512' npm run test:frontend
```
Output:
```
▶ hearing.mjs
  ✔ initial state verification
  ✔ full sample script cursor verification
  ✔ proposal/ruling item histories
  ✔ event ID duplicate rejection
  ✔ max 4 rounds verification
  ✔ all supported types verification
  ✔ no verdict before items agreed
  ✔ pause at appeal blocks advance
  ✔ both resolveAppeal choices exactly once
  ✔ invalid choice rejected
  ✔ restart createState independent
  ✔ no history mutation by incoming event
  ✔ export contains all messages and honest sample disclaimer
  ✔ applyEvent edge cases
  ✔ characters and speakers exports
✔ hearing.mjs
▶ server.mjs
  ✔ HTTP server /200 html
  ✔ MJS content type
  ✔ SVG content type with actual /art/seal.svg
  ✔ HEAD method
  ✔ unsupported methods 405
  ✔ no .env access 404
  ✔ no package.json access 404
  ✔ no backend access 404
  ✔ encoded traversal denied
  ✔ malformed URI 400
  ✔ nonexistent file 404
  ✔ CSP header self-only
  ✔ security headers
  ✔ Cache-Control header
  ✔ Content-Type for various extensions
✔ server.mjs
ℹ tests 30
ℹ suites 2
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Full Test Suite (Backend Existing + Frontend New)
Command:
```bash
npm test
```
Breakdown:
- Backend existing tests: 58 tests passed
- Frontend tests: 30 tests (2 suites) passed
- Total:
```
ℹ tests 88
ℹ suites 2
ℹ pass 88
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Syntax Validation
Command:
```bash
npm run check
```
Exit code: **0**. Node's syntax checker emitted no diagnostics for
`frontend/public/app.mjs`, `frontend/public/hearing.mjs`, or `frontend/server.mjs`.

## Test Coverage Detail

### Frontend hearing.mjs Tests (15 tests)
1. ✅ Initial state verification
2. ✅ Full sample script cursor verification
3. ✅ Proposal/ruling item histories
4. ✅ Event ID duplicate rejection (including no animation trigger return false)
5. ✅ Max 4 rounds verification
6. ✅ All supported types verification
7. ✅ No verdict before items agreed
8. ✅ Pause at appeal blocks advance
9. ✅ Both resolveAppeal choices exactly once
10. ✅ Invalid choice rejected
11. ✅ Restart createState independent
12. ✅ No history mutation by incoming event
13. ✅ Export contains all messages and honest sample disclaimer
14. ✅ ApplyEvent edge cases
15. ✅ Characters and speakers exports

### Frontend server.mjs Tests (15 tests)
1. ✅ HTTP server /200 html
2. ✅ MJS content type
3. ✅ SVG content type with actual /art/seal.svg
4. ✅ HEAD method
5. ✅ Unsupported methods 405
6. ✅ No .env access 404
7. ✅ No package.json access 404
8. ✅ No backend access 404
9. ✅ Encoded traversal denied
10. ✅ Malformed URI 400
11. ✅ Nonexistent file 404
12. ✅ CSP header self-only
13. ✅ Security headers
14. ✅ Cache-Control header
15. ✅ Content-Type for various extensions

## Environment
- **Node.js Version**: v24.21.0
- **NODE_OPTIONS**: --max-old-space-size=512
- **Module System**: ES Modules (`node:test`, `node:assert`)
