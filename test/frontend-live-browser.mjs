import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fixture } from './court-fixture.mjs';
import { sampleBoard, objectBrief } from '../src/court-engine.mjs';
import { createCourtServer } from '../src/court-http.mjs';

const requireQA = createRequire(process.env.QA_MODULES || '/tmp/opencode/delegates-qa/package.json');
const { chromium } = requireQA('playwright');
const AxeBuilder = requireQA('@axe-core/playwright').default || requireQA('@axe-core/playwright');

const CHROMIUM_PATH = process.env.CHROMIUM_EXECUTABLE || '/home/harshil/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const SCREENSHOT_DIR = 'design-review/integration';
const RESULTS_FILE = 'docs/frontend-live-browser-results.json';

await mkdir(SCREENSHOT_DIR, { recursive: true });
await mkdir('docs', { recursive: true });

const results = {
  startedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    chromiumPath: CHROMIUM_PATH,
    qaModules: process.env.QA_MODULES || '/tmp/opencode/delegates-qa/package.json',
  },
  checks: [],
  networkErrors: [],
  consoleLogs: [],
  axeAudit: {
    desktop: null,
    mobile: null,
  },
};

let checkIndex = 0;
async function runCheck(name, fn) {
  checkIndex++;
  const record = { id: checkIndex, name, passed: false, durationMs: 0 };
  const start = Date.now();
  try {
    await fn();
    record.passed = true;
    record.durationMs = Date.now() - start;
    results.checks.push(record);
    console.log(`[PASS] ${name} (${record.durationMs}ms)`);
  } catch (err) {
    record.passed = false;
    record.error = err.message;
    record.stack = err.stack;
    record.durationMs = Date.now() - start;
    results.checks.push(record);
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

// Launch browser once for the suite
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROMIUM_PATH,
});

// Helper to exercise GSAP ScrollTrigger reveals down through the casefile panels
async function exerciseScrollReveals(page) {
  for (const selector of ['.briefs', '.board', '.signatures', '.record']) {
    const loc = page.locator(selector);
    if (await loc.count() > 0) {
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

// Helper to wait until fonts are ready, GSAP entrance settled, and scroll reveals triggered
async function awaitSettled(page, ms = 2800) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
  await exerciseScrollReveals(page);
}

try {
  // ── Main Live Engine & Server Setup ───────────────────────────────────────
  const f = fixture();
  let ingestionStatus = { state: 'starting', failures: 0 };

  const courtServer = createCourtServer(f.engine, {
    port: 0,
    streamPollMs: 40,
    status: () => ingestionStatus,
  });
  courtServer.listen(0, '127.0.0.1');
  await once(courtServer, 'listening');
  const courtPort = courtServer.address().port;

  // Set env var before importing frontend/server.mjs so proxy forwards correctly
  process.env.CVC_COURT_PORT = String(courtPort);
  const { createFrontendServer } = await import('../frontend/server.mjs');
  const frontendServer = createFrontendServer({ courtPort });
  frontendServer.listen(0, '127.0.0.1');
  await once(frontendServer, 'listening');
  const frontendPort = frontendServer.address().port;
  const baseUrl = `http://127.0.0.1:${frontendPort}`;

  console.log(`Live test servers: court=${courtPort}, frontend=${frontendPort}`);

  async function createTrackedContext(options = {}) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...options,
    });
    return context;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Check 1: Ingestion status labeling & human ADOPT commands (Full Page Desktop)
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('1. Initial connection shows starting clerk and unadopted human ADOPT commands', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#mode');

      // Status when ingestion is starting/null
      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Connected clerk · starting room/i, 'Starting ingestion shows connected clerk status');
      assert.notEqual(modeLabel, 'Live · Switch room', 'Must NOT claim live Switch room when starting');

      // In AWAITING_MANDATES, unadopted briefs show human ADOPT commands from view.adopt
      const leadAdopt = await page.locator('.brief[data-role="lead"] .brief-adopt code').textContent();
      const creatorAdopt = await page.locator('.brief[data-role="creator"] .brief-adopt code').textContent();
      assert.match(leadAdopt, /^@cvc-clerk ADOPT C01 H1/, 'Lead brief shows human ADOPT command');
      assert.match(creatorAdopt, /^@cvc-clerk ADOPT C01 D1/, 'Creator brief shows human ADOPT command');

      // Check DRAFT seals
      assert.equal(await page.locator('.brief[data-role="lead"] .seal').textContent(), 'DRAFT');
      assert.equal(await page.locator('.brief[data-role="creator"] .seal').textContent(), 'DRAFT');

      // Capture settled full-page screenshot
      await awaitSettled(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-mandates-unadopted.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 2: Live SSE state update & brief adoption (Full Page Desktop)
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('2. Ingestion live SSE update and live brief adoption in room', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#mode');

      // Transition ingestion to live
      ingestionStatus = { state: 'live', failures: 0 };
      await page.waitForFunction(() => document.querySelector('#mode-label')?.textContent?.includes('Live · Switch room'), { timeout: 4000 });
      assert.equal(await page.locator('#mode').getAttribute('data-mode'), 'live');

      // Adopt Lead mandate
      f.human('lead', f.snapshot().commands.adopt.lead);
      await page.waitForFunction(() => {
        const seal = document.querySelector('.brief[data-role="lead"] .seal');
        return seal && seal.textContent === 'ADOPTED';
      }, { timeout: 4000 });

      // Lead adopt command removed, creator still DRAFT + adopt command
      assert.equal(await page.locator('.brief[data-role="lead"] .brief-adopt').count(), 0);
      assert.equal(await page.locator('.brief[data-role="creator"] .seal').textContent(), 'DRAFT');

      // Adopt Creator mandate
      f.human('creator', f.snapshot().commands.adopt.creator);
      await page.waitForFunction(() => {
        const seal = document.querySelector('.brief[data-role="creator"] .seal');
        return seal && seal.textContent === 'ADOPTED';
      }, { timeout: 4000 });
      assert.equal(await page.locator('.brief[data-role="creator"] .brief-adopt').count(), 0);

      await awaitSettled(page);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-mandates-adopted.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 3: Board proposal check failure & veto marks
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('3. Board proposal check failure triggers objection and veto marks', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#board');

      // Propose board containing the forbidden portrait asset
      const vetoBoard = sampleBoard('H1');
      vetoBoard.panels[0] = { ...vetoBoard.panels[0], assetId: 'portrait-daksh' };
      f.propose(vetoBoard);

      await page.waitForFunction(() => {
        const meta = document.querySelector('#board-meta');
        return meta && meta.textContent.includes('BOARD1');
      }, { timeout: 4000 });

      const meta = await page.locator('#board-meta').textContent();
      assert.match(meta, /BOARD1 · 4 panels · 30s/);

      const failedChecks = await page.locator('#checks li[data-pass="false"]').count();
      assert.ok(failedChecks >= 1, 'At least one check must fail for H1 proposal');

      await page.waitForSelector('.card.is-vetoed', { timeout: 4000 });
      const vetoedCount = await page.locator('.card.is-vetoed').count();
      assert.ok(vetoedCount >= 1, 'Forbidden asset card must be marked vetoed');

      await awaitSettled(page, 1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-board-objection.png` });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 4: Recess, human amendment request & owner decision
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('4. Advocate amendment request pauses court in recess until authenticated owner decision', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#stage');

      // Creator advocate requests amendment to objectBrief
      f.agent('creator', `REQUEST C01 H1 ${JSON.stringify(objectBrief)}`);

      // Section #question should become visible
      await page.waitForFunction(() => {
        const q = document.querySelector('#question');
        return q && !q.hidden;
      }, { timeout: 4000 });

      const questionOwner = await page.locator('#question-owner').textContent();
      assert.equal(questionOwner, 'fixture-lead', 'Question must target lead owner');

      const acceptCmd = await page.locator('#question-accept').textContent();
      const declineCmd = await page.locator('#question-decline').textContent();
      assert.match(acceptCmd, /^@cvc-clerk ACCEPT C01 A1/);
      assert.match(declineCmd, /^@cvc-clerk DECLINE C01 A1/);

      await awaitSettled(page, 1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-recess-question.png` });

      // Owner sends authenticated ACCEPT decision via backend fixture
      const action = f.snapshot().commands.amendments[0];
      assert.ok(action, 'Amendment command must exist');
      f.human('lead', action.accept);

      // Question section hides after decision
      await page.waitForFunction(() => {
        const q = document.querySelector('#question');
        return !q || q.hidden;
      }, { timeout: 4000 });

      // Briefs header should now show H2 for lead
      await page.waitForFunction(() => {
        const briefRef = document.querySelector('.brief[data-role="lead"] .eyebrow');
        return briefRef && briefRef.textContent.includes('H2');
      }, { timeout: 4000 });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 5: Passing board proposal, approvals & exports (Full Page Desktop)
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('5. Passing storyboard passes checks, gates exports, requires both owner approvals', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#board');

      // Propose passing board (revision 2)
      f.propose(sampleBoard());

      await page.waitForFunction(() => {
        const meta = document.querySelector('#board-meta');
        return meta && meta.textContent.includes('BOARD2');
      }, { timeout: 4000 });

      const passChecks = await page.locator('#checks li[data-pass="true"]').count();
      const failChecks = await page.locator('#checks li[data-pass="false"]').count();
      assert.ok(passChecks >= 4, 'Passing checks present');
      assert.equal(failChecks, 0, 'No failing checks');

      // AWAITING_APPROVALS: sign-note displays the command
      await page.waitForFunction(() => {
        const note = document.querySelector('#sign-note');
        return note && note.textContent.includes('@cvc-clerk APPROVE C01 BOARD2');
      }, { timeout: 4000 });

      // Exports must be empty before both owners sign
      assert.equal(await page.locator('#exports a').count(), 0);

      // Attempting premature download fails (409)
      const prematureExport = await fetch(`${baseUrl}/api/cases/C01/boards/2/export`);
      assert.equal(prematureExport.status, 409, 'Gated: export must return 409 before two approvals');

      // Lead signs
      const approveCmd = f.snapshot().commands.approve;
      assert.ok(approveCmd, 'Approve command must be available');
      f.human('lead', approveCmd);

      await page.waitForFunction(() => {
        const slot = document.querySelector('.seal-slot[data-role="lead"]');
        return slot && slot.classList.contains('is-signed');
      }, { timeout: 4000 });
      assert.equal(await page.locator('.seal-slot[data-role="creator"]').evaluate(el => el.classList.contains('is-signed')), false);
      assert.equal(await page.locator('#exports a').count(), 0, 'Exports still gated after 1 approval');

      // Creator signs
      f.human('creator', approveCmd);

      await page.waitForFunction(() => {
        const slot = document.querySelector('.seal-slot[data-role="creator"]');
        return slot && slot.classList.contains('is-signed');
      }, { timeout: 4000 });

      // Sign-note stale command must be reset
      const finalNote = await page.locator('#sign-note').textContent();
      assert.equal(finalNote, 'An advocate can argue for its owner. It can never consent for them.', 'Stale approve command must not persist');

      // Exports must now appear
      await page.waitForSelector('#exports a', { timeout: 4000 });
      const exportLinks = await page.locator('#exports a').allTextContents();
      assert.ok(exportLinks.includes('Approved storyboard'));
      assert.ok(exportLinks.includes('Script'));
      assert.ok(exportLinks.includes('Consent receipt'));

      // Fetch actual export bytes
      const exportRes = await fetch(`${baseUrl}/api/cases/C01/boards/2/export`);
      assert.equal(exportRes.status, 200, 'Approved export returns 200');
      const exportText = await exportRes.text();
      assert.ok(exportText.includes('<!doctype html>'), 'Export returns HTML document');
      assert.ok(exportRes.headers.get('etag'), 'Export includes ETag digest');

      // Settle and capture full-page screenshot exposing both seals and exports
      await awaitSettled(page);

      // Verify actual visibility of reveal sections after scrolling
      for (const sel of ['.briefs', '.board', '.signatures', '.record']) {
        const opacity = await page.locator(sel).evaluate(el => parseFloat(getComputedStyle(el).opacity));
        assert.ok(opacity > 0.8, `${sel} must be visible (opacity > 0.8) after scrolling`);
      }
      assert.equal(await page.locator('#exports').isVisible(), true, 'Exports must be visible');
      assert.equal(await page.locator('.seals').isVisible(), true, 'Seals must be visible');

      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-approved-verdict.png`, fullPage: true });
      await page.locator('.signatures').screenshot({ path: `${SCREENSHOT_DIR}/live-approved-signatures.png` });
      await page.locator('.board').screenshot({ path: `${SCREENSHOT_DIR}/live-approved-board.png` });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 6: Dedup & no duplicate history rechoreographing on repeated snapshot
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('6. Dedup perform by beat id and avoid duplicate history effects on repeated snapshot', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#beats .beat');

      // Verify no duplicate IDs in record
      const beatNumbers = await page.locator('#beats .beat .n').allTextContents();
      const uniqueBeatNumbers = new Set(beatNumbers);
      assert.equal(beatNumbers.length, uniqueBeatNumbers.size, 'Beat records must not contain duplicates');

      // Track stamps before repeated snapshot
      const initialBeatsCount = await page.locator('#beats .beat').count();

      // Trigger a stream error and recovery so reconcileLiveSnapshot runs
      await page.evaluate(() => {
        if (window._testTriggerReconnect) window._testTriggerReconnect();
      });
      await page.waitForTimeout(600);

      // Verify beat count remains unchanged and no duplicate list items exist
      const afterBeatsCount = await page.locator('#beats .beat').count();
      assert.equal(afterBeatsCount, initialBeatsCount, 'Repeated snapshot must not duplicate historical records');

      // Ingestion pause / resume transitions
      ingestionStatus = { state: 'paused', failures: 3, reason: 'Test poll timeout' };
      await page.waitForFunction(() => document.querySelector('#mode-label')?.textContent?.includes('Room ingestion paused'), { timeout: 4000 });
      assert.equal(await page.locator('#mode').getAttribute('data-mode'), 'offline');

      ingestionStatus = { state: 'live', failures: 0 };
      await page.waitForFunction(() => document.querySelector('#mode-label')?.textContent?.includes('Live · Switch room'), { timeout: 4000 });
      assert.equal(await page.locator('#mode').getAttribute('data-mode'), 'live');
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 7: 404 missing case and invalid case query show unavailable
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('7. 404 missing case and invalid case query show unavailable without silent replay C01', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      // 404 for unknown case C99
      await page.goto(`${baseUrl}/court.html?case=C99`);
      await page.waitForSelector('#mode');

      const caseIdText = await page.locator('#case-id').textContent();
      assert.equal(caseIdText, 'C99', 'Case chip shows requested C99');
      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Court unavailable/i, 'Mode label shows Court unavailable on 404');
      const footSource = await page.locator('#foot-source').textContent();
      assert.match(footSource, /not found/i, 'Footer notes case not found');
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'Replay bar must NOT be visible on 404');
      assert.equal(await page.locator('#retry-live').isVisible(), true, 'Retry live button must be visible');

      await awaitSettled(page, 1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/error-404-case.png` });

      // Invalid case query syntax
      await page.goto(`${baseUrl}/court.html?case=bad_query!`);
      await page.waitForSelector('#mode');
      const invalidMode = await page.locator('#mode-label').textContent();
      assert.match(invalidMode, /Court unavailable/i);
      const invalidFoot = await page.locator('#foot-source').textContent();
      assert.match(invalidFoot, /Invalid case identifier/i);
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'No replay on invalid query');

      await awaitSettled(page, 1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/error-invalid-case.png` });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 8: Fault injection — HTTP 500 shows unavailable with retry, NO replay
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('8. Fault injection: HTTP 500 server error shows unavailable + retry, strictly NO replay', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      // Intercept /court route with HTTP 500
      await page.route('**/api/cases/C01/court', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal database lock error' }),
        });
      });

      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#mode');

      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Court unavailable/i, 'HTTP 500 must show Court unavailable');
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'HTTP 500 must NEVER fall back to replay');
      assert.equal(await page.locator('#retry-live').isVisible(), true, 'Retry button must be visible');
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 9: Fault injection — Malformed JSON / schema mismatch shows unavailable
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('9. Fault injection: Malformed JSON and schema version mismatch show unavailable + retry', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      // Intercept with invalid version
      await page.route('**/api/cases/C01/court', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ version: 'wrong-version', caseId: 'C01', stage: 'AWAITING_MANDATES' }),
        });
      });

      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#mode');

      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Court unavailable/i, 'Schema mismatch must show Court unavailable');
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'Schema mismatch must NEVER fall back to replay');
      assert.equal(await page.locator('#retry-live').isVisible(), true, 'Retry button must be visible');
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 10: Unreachable 502 clerk falls back to recorded replay
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('10. Unreachable clerk falls back to recorded replay with clear labeling and timer controls', async () => {
    const deadPort = 59998;
    process.env.CVC_COURT_PORT = String(deadPort);
    const deadFrontend = createFrontendServer({ courtPort: deadPort });
    deadFrontend.listen(0, '127.0.0.1');
    await once(deadFrontend, 'listening');
    const deadFrontendPort = deadFrontend.address().port;

    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`http://127.0.0.1:${deadFrontendPort}/court.html?case=C01`);
      await page.waitForSelector('#replay-bar');

      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Replay · recorded rehearsal/i);
      const footSource = await page.locator('#foot-source').textContent();
      assert.match(footSource, /recorded replay|synthetic rehearsal/i, 'Footer must state recorded/synthetic rehearsal fallback');

      assert.equal(await page.locator('#retry-live').isVisible(), true, 'Retry button visible during fallback');
      assert.equal(await page.locator('#exports a').count(), 0, 'Replay exports must not link to live approvals');

      // Test replay controls: Pause within 1.4s cancels auto-start timer
      await page.locator('#replay-toggle').click();
      assert.equal(await page.locator('#replay-toggle').textContent(), 'Play');
      await page.waitForTimeout(1600);
      assert.equal(await page.locator('#replay-toggle').textContent(), 'Play', 'Auto-start timer was cancelled by pause');

      await awaitSettled(page, 1500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/replay-fallback.png` });
    } finally {
      deadFrontend.close();
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 11: Retry while replaying — actual-engine lifecycle & no handler accumulation
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('11. Retry while replaying resets session lifecycle and does not accumulate event handlers', async () => {
    // 1. Reserve an ephemeral port for the court backend that is not listening yet
    const { createServer } = await import('node:http');
    const dummy = createServer();
    dummy.listen(0, '127.0.0.1');
    await once(dummy, 'listening');
    const dynamicCourtPort = dummy.address().port;
    dummy.close();
    await once(dummy, 'close');

    // Start frontend proxy pointing to the offline dynamicCourtPort
    process.env.CVC_COURT_PORT = String(dynamicCourtPort);
    const retryFrontend = createFrontendServer({ courtPort: dynamicCourtPort });
    retryFrontend.listen(0, '127.0.0.1');
    await once(retryFrontend, 'listening');
    const retryFrontendPort = retryFrontend.address().port;

    const context = await createTrackedContext();
    const page = await context.newPage();
    let liveCourt = null;
    try {
      // Navigate to court when backend is completely offline
      await page.goto(`http://127.0.0.1:${retryFrontendPort}/court.html?case=C01`);
      await page.waitForSelector('#replay-bar');
      assert.equal(await page.locator('#replay-bar').isVisible(), true, 'Replay bar visible during fallback');

      // Let replay timer advance so recorded beats and state populate
      await page.waitForTimeout(1600);
      assert.ok(await page.locator('#beats .beat').count() > 0, 'Replay has populated recorded beats');

      // Click failed retry #1 (backend still offline)
      await page.locator('#retry-live').click();
      await page.waitForSelector('#replay-bar');

      // Click failed retry #2 (backend still offline)
      await page.locator('#retry-live').click();
      await page.waitForSelector('#replay-bar');

      // Pause replay playback
      if (await page.locator('#replay-toggle').textContent() === 'Pause') {
        await page.locator('#replay-toggle').click();
      }

      // Verify handler accumulation: clicking Next ONCE must advance by EXACTLY 1 beat
      const countTextBefore = await page.locator('#replay-count').textContent();
      const currentStep = parseInt(countTextBefore.split('/')[0].trim(), 10);

      await page.locator('#replay-step').click();
      await page.waitForTimeout(200);

      const countTextAfter = await page.locator('#replay-count').textContent();
      const nextStep = parseInt(countTextAfter.split('/')[0].trim(), 10);
      assert.equal(nextStep, currentStep + 1, `Clicking Next must advance exactly 1 step (was ${currentStep}, now ${nextStep})`);

      // 2. Now start actual real CourtEngine on dynamicCourtPort
      const fRetry = fixture();
      liveCourt = createCourtServer(fRetry.engine, {
        port: dynamicCourtPort,
        streamPollMs: 40,
        status: () => ({ state: 'live', failures: 0 }),
      });
      liveCourt.listen(dynamicCourtPort, '127.0.0.1');
      await once(liveCourt, 'listening');

      // 3. Click Retry live — client resets session and connects to live court
      await page.locator('#retry-live').click();

      // Wait for live mode to establish through real engine + SSE
      await page.waitForFunction(() => {
        const modeLabel = document.querySelector('#mode-label')?.textContent;
        return modeLabel && (modeLabel.includes('Live · Switch room') || modeLabel.includes('Connected clerk'));
      }, { timeout: 6000 });

      // Verify replay controls are hidden and retry button is hidden
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'Replay bar must be hidden in live mode');
      assert.equal(await page.locator('#retry-live').isVisible(), false, 'Retry button hidden in live mode');

      // Verify live brief adoption commands appear and old replay beats are gone
      const leadAdopt = await page.locator('.brief[data-role="lead"] .brief-adopt code').textContent();
      assert.match(leadAdopt, /^@cvc-clerk ADOPT C01 H1/, 'Live brief adoption commands present on reset');

      // Wait 2 seconds and verify replay timer does NOT write or advance
      await page.waitForTimeout(2000);
      assert.equal(await page.locator('#replay-bar').isVisible(), false, 'Replay bar remains hidden');
    } finally {
      if (liveCourt) liveCourt.close();
      retryFrontend.close();
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 12: Explicit ?replay=1 query
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('12. Explicit ?replay=1 enters replay directly', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01&replay=1`);
      await page.waitForSelector('#replay-bar');
      const modeLabel = await page.locator('#mode-label').textContent();
      assert.match(modeLabel, /Replay · recorded rehearsal/i);
      assert.equal(await page.locator('#replay-bar').isVisible(), true);
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 13: Runtime reduced motion cleanup & text visibility
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('13. Runtime reduced motion cleanup stops court animations and keeps reveals visible', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#stage');

      // Emulate reduced motion dynamically at runtime
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(300);

      // Verify text elements and reveal panels are visible with opacity 1 and no hidden state
      const opacity = await page.locator('#phase-label').evaluate(el => getComputedStyle(el).opacity);
      assert.equal(opacity, '1', 'Phase label must be fully visible under reduced motion');

      const revealsVisible = await page.locator('.reveal').evaluateAll(elements =>
        elements.every(el => getComputedStyle(el).opacity !== '0' && getComputedStyle(el).visibility !== 'hidden')
      );
      assert.ok(revealsVisible, 'All case file reveal panels must remain visible');
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 14: Responsive narrow mobile viewport (375x667)
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('14. Responsive narrow mobile viewport (375x667) without horizontal overflow', async () => {
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/court.html?case=C01`);
      await page.waitForSelector('#stage');
      await awaitSettled(page);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      assert.ok(scrollWidth <= innerWidth + 1, `Mobile layout must not horizontally overflow (scrollWidth=${scrollWidth}, innerWidth=${innerWidth})`);

      await page.screenshot({ path: `${SCREENSHOT_DIR}/live-mobile-view.png`, fullPage: true });
    } finally {
      await context.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 15: Accessibility axe audit on stable live desktop & mobile
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('15. Axe accessibility audit on stable desktop and mobile live views', async () => {
    // Desktop audit
    const desktopContext = await createTrackedContext();
    const desktopPage = await desktopContext.newPage();
    try {
      await desktopPage.goto(`${baseUrl}/court.html?case=C01`);
      await desktopPage.waitForSelector('#stage');
      await awaitSettled(desktopPage);

      const desktopAxe = await new AxeBuilder({ page: desktopPage })
        .disableRules(['color-contrast'])
        .analyze();

      results.axeAudit.desktop = {
        violations: desktopAxe.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length })),
        passes: desktopAxe.passes.length,
      };
      assert.equal(desktopAxe.violations.length, 0, `Desktop axe violations: ${JSON.stringify(desktopAxe.violations)}`);
    } finally {
      await desktopContext.close();
    }

    // Mobile audit
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
    const mobilePage = await mobileContext.newPage();
    try {
      await mobilePage.goto(`${baseUrl}/court.html?case=C01`);
      await mobilePage.waitForSelector('#stage');
      await awaitSettled(mobilePage);

      const mobileAxe = await new AxeBuilder({ page: mobilePage })
        .disableRules(['color-contrast'])
        .analyze();

      results.axeAudit.mobile = {
        violations: mobileAxe.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.length })),
        passes: mobileAxe.passes.length,
      };
      assert.equal(mobileAxe.violations.length, 0, `Mobile axe violations: ${JSON.stringify(mobileAxe.violations)}`);
    } finally {
      await mobileContext.close();
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Check 16: Root / navigation link
  // ──────────────────────────────────────────────────────────────────────────
  await runCheck('16. Root / navigation includes live court link or entry', async () => {
    const context = await createTrackedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/`);
      const liveLinks = await page.locator('a[href="/court.html"]').count();
      assert.ok(liveLinks >= 1, 'Root page provides link to live court /court.html');
    } finally {
      await context.close();
    }
  });

  // Cleanup servers
  frontendServer.close();
  courtServer.close();
} finally {
  await browser.close();
}

// ── Write Machine Results ───────────────────────────────────────────────────
results.completedAt = new Date().toISOString();
results.summary = {
  total: results.checks.length,
  passed: results.checks.filter(c => c.passed).length,
  failed: results.checks.filter(c => !c.passed).length,
};

await writeFile(RESULTS_FILE, JSON.stringify(results, null, 2) + '\n');
console.log(`\nBrowser test suite finished: ${results.summary.passed}/${results.summary.total} passed. Results saved to ${RESULTS_FILE}`);

if (results.summary.failed > 0) {
  process.exitCode = 1;
}
