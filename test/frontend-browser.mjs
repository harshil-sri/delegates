import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const requireQA = createRequire(process.env.QA_MODULES || '/tmp/opencode/delegates-qa/package.json');
const { chromium } = requireQA('playwright');
const { AxeBuilder } = requireQA('@axe-core/playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const RESULTS_FILE = path.resolve('docs/frontend-browser-results.json');
const SCREENSHOT_DIR = path.resolve('design-review/final');

function pickExecutable() {
  if (process.env.CHROMIUM_EXECUTABLE) {
    if (fs.existsSync(process.env.CHROMIUM_EXECUTABLE)) {
      return process.env.CHROMIUM_EXECUTABLE;
    }
    throw new Error(`CHROMIUM_EXECUTABLE points to non-existent path: ${process.env.CHROMIUM_EXECUTABLE}`);
  }

  try {
    const pwPath = chromium.executablePath();
    if (pwPath && fs.existsSync(pwPath)) {
      return pwPath;
    }
  } catch (_) {}

  const home = os.homedir();
  const fallbackCandidates = [
    path.join(home, '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
    path.join(home, '.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),
    path.join(home, '.cache/ms-playwright/chromium_headless_shell-1248/chrome-linux64/headless_shell'),
    path.join(home, '.cache/ms-playwright/chromium_headless_shell-1234/chrome-linux64/headless_shell'),
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
  ];

  for (const candidate of fallbackCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`No compatible Chromium binary found. Tried CHROMIUM_EXECUTABLE, chromium.executablePath(), and:\n${fallbackCandidates.join('\n')}`);
}

async function settleView(page, waitMs = 300) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
}

async function resetDocScrollAndSettle(page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

async function main() {
  const executablePath = pickExecutable();
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });

  const testReport = {
    timestamp: new Date().toISOString(),
    executablePath,
    baseUrl: BASE_URL,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      axeViolationsCount: 0
    },
    cases: [],
    axeViolations: {},
    resourceErrors: [],
    defects: []
  };

  async function runCase(id, title, fn) {
    testReport.summary.total += 1;
    const start = Date.now();
    try {
      const details = await fn();
      const durationMs = Date.now() - start;
      testReport.summary.passed += 1;
      testReport.cases.push({
        id,
        title,
        status: 'passed',
        durationMs,
        details: details || null,
        error: null
      });
      console.log(`[PASS] ${id}: ${title} (${durationMs}ms)`);
    } catch (err) {
      const durationMs = Date.now() - start;
      testReport.summary.failed += 1;
      testReport.cases.push({
        id,
        title,
        status: 'failed',
        durationMs,
        details: null,
        error: {
          message: err.message,
          stack: err.stack
        }
      });
      console.error(`[FAIL] ${id}: ${title} - ${err.message}`);
    }
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  try {
    // 1. Keyboard Navigation & Immediate Skip Intro First
    await runCase('keyboard_skip_intro', 'Immediate Skip intro keyboard first, focuses #main, intro inert', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);

      await page.keyboard.press('Tab');
      const activeFirst = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el ? el.tagName : null,
          className: el ? el.className : null,
          href: el ? el.getAttribute('href') : null
        };
      });
      assert.equal(activeFirst.tag, 'A', 'First tab target should be <a> tag');
      assert.ok(activeFirst.className.includes('skip-link'), 'First tab target should be .skip-link');
      assert.equal(activeFirst.href, '#main', 'Skip link should point to #main');

      await page.keyboard.press('Enter');
      await settleView(page, 150);

      const courtState = await page.evaluate(() => {
        const main = document.querySelector('#main');
        const intro = document.querySelector('#intro');
        const workspace = document.querySelector('#workspace');
        return {
          mainFocused: document.activeElement === main,
          introHidden: intro.hidden,
          introInert: intro.inert,
          workspaceHidden: workspace.hidden,
          workspaceInert: workspace.inert
        };
      });

      assert.ok(courtState.mainFocused, 'Entering court must focus #main');
      assert.ok(courtState.introHidden, 'Intro must be hidden after skip');
      assert.ok(courtState.introInert, 'Intro must be inert after skip');
      assert.equal(courtState.workspaceHidden, false, 'Workspace must not be hidden');
      assert.equal(courtState.workspaceInert, false, 'Workspace must not be inert');

      await context.close();
      return courtState;
    });

    // 2. Resource Loading & Network Assets
    await runCase('assets_and_resources', 'All images and fonts loaded with no resource errors', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const localResourceErrors = [];

      page.on('requestfailed', req => {
        localResourceErrors.push({ url: req.url(), error: req.failure()?.errorText || 'failed' });
      });
      page.on('response', res => {
        if (res.status() >= 400) {
          localResourceErrors.push({ url: res.url(), status: res.status() });
        }
      });

      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      const check = await page.evaluate(() => {
        const fontsLoaded = document.fonts.status === 'loaded';
        const imgs = Array.from(document.querySelectorAll('img'));
        const unloaded = imgs
          .filter(img => !img.complete || img.naturalWidth === 0)
          .map(img => img.src);
        return {
          fontsLoaded,
          totalImages: imgs.length,
          unloadedImages: unloaded
        };
      });

      testReport.resourceErrors.push(...localResourceErrors);
      assert.equal(localResourceErrors.length, 0, `Expected 0 resource errors, got: ${JSON.stringify(localResourceErrors)}`);
      assert.ok(check.fontsLoaded, 'All document fonts must be loaded');
      assert.equal(check.unloadedImages.length, 0, `All images must be loaded, found broken: ${check.unloadedImages.join(', ')}`);

      await context.close();
      return check;
    });

    // 3. Desktop 3:1 Ratio & Zero Horizontal Overflow Across Viewports
    await runCase('layout_viewports_and_overflow', 'Desktop 3:1 ratio (unless 300px min) and zero horizontal overflow across viewports', async () => {
      const viewports = [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'compact', width: 1024, height: 768 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 },
        { name: 'small_mobile', width: 320, height: 740 }
      ];

      const results = {};
      for (const vp of viewports) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        await page.goto(BASE_URL);
        await settleView(page);
        await page.click('#skip-intro');
        await settleView(page);

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const mainEl = document.querySelector('.court-main');
          const switchEl = document.querySelector('.switch-panel');
          const mainRect = mainEl?.getBoundingClientRect();
          const switchRect = switchEl?.getBoundingClientRect();

          return {
            clientWidth: doc.clientWidth,
            scrollWidth: doc.scrollWidth,
            hasOverflow: doc.scrollWidth > doc.clientWidth,
            courtMainWidth: mainRect?.width || 0,
            switchPanelWidth: switchRect?.width || 0
          };
        });

        assert.equal(metrics.hasOverflow, false, `Horizontal overflow detected in ${vp.name} (${metrics.scrollWidth} > ${metrics.clientWidth})`);

        if (vp.name === 'desktop') {
          const ratio = metrics.courtMainWidth / metrics.switchPanelWidth;
          assert.ok(Math.abs(ratio - 3) < 0.1, `Desktop layout should be ~3:1 ratio, got ${ratio.toFixed(2)}`);
        } else if (vp.name === 'compact') {
          assert.ok(metrics.switchPanelWidth >= 300, `Switch panel should respect 300px minimum in compact`);
        }

        results[vp.name] = metrics;
        await context.close();
      }

      return results;
    });

    // 4. Judges Scene Bounds & Equal Widths
    await runCase('judges_scene_bounds_and_widths', 'All 3 judges in scene bounds with equal widths', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      const judgesData = await page.evaluate(() => {
        const sceneRect = document.querySelector('#court-scene').getBoundingClientRect();
        const judges = Array.from(document.querySelectorAll('#court-scene .judge')).map(j => {
          const r = j.getBoundingClientRect();
          return {
            id: j.dataset.character,
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            inSceneBounds: r.left >= sceneRect.left && r.right <= sceneRect.right && r.top >= sceneRect.top && r.bottom <= sceneRect.bottom
          };
        });
        return { sceneRect, judges };
      });

      assert.equal(judgesData.judges.length, 3, 'There must be exactly 3 judges in the courtroom scene');
      for (const judge of judgesData.judges) {
        assert.ok(judge.inSceneBounds, `Judge ${judge.id} must be within courtroom scene bounds`);
      }

      const widths = judgesData.judges.map(j => j.width);
      const minW = Math.min(...widths);
      const maxW = Math.max(...widths);
      assert.ok(maxW - minW < 1.0, `All judges must have equal widths, variation was ${(maxW - minW).toFixed(2)}px`);

      await context.close();
      return judgesData;
    });

    // 5. Provider Logos Natural Aspect & OpenAI Adaptive SVG Styling
    await runCase('provider_marks_aspect_and_styling', 'Provider natural aspects preserved and OpenAI SVG color-scheme:light', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      const marks = await page.evaluate(() => {
        const openai = document.querySelector('#court-scene .advocate-mark.left img');
        const claude = document.querySelector('#court-scene .advocate-mark.right img');
        const openaiStyle = window.getComputedStyle(openai);
        const claudeStyle = window.getComputedStyle(claude);

        return {
          openai: {
            naturalWidth: openai.naturalWidth,
            naturalHeight: openai.naturalHeight,
            renderedWidth: openai.getBoundingClientRect().width,
            renderedHeight: openai.getBoundingClientRect().height,
            colorScheme: openaiStyle.colorScheme
          },
          claude: {
            naturalWidth: claude.naturalWidth,
            naturalHeight: claude.naturalHeight,
            renderedWidth: claude.getBoundingClientRect().width,
            renderedHeight: claude.getBoundingClientRect().height,
            colorScheme: claudeStyle.colorScheme
          }
        };
      });

      assert.ok(marks.openai.naturalWidth > 0 && marks.openai.naturalHeight > 0, 'OpenAI mark must load valid natural dimensions');
      assert.ok(marks.claude.naturalWidth > 0 && marks.claude.naturalHeight > 0, 'Claude mark must load valid natural dimensions');

      const openaiAspect = marks.openai.renderedWidth / marks.openai.renderedHeight;
      const claudeAspect = marks.claude.renderedWidth / marks.claude.renderedHeight;
      assert.ok(Math.abs(openaiAspect - 1.0) < 0.05, `OpenAI mark aspect ratio must be 1:1, got ${openaiAspect.toFixed(2)}`);
      assert.ok(Math.abs(claudeAspect - 1.0) < 0.05, `Claude mark aspect ratio must be 1:1, got ${claudeAspect.toFixed(2)}`);

      assert.equal(marks.openai.colorScheme, 'light', 'OpenAI mark image must have color-scheme: light');
      assert.equal(marks.claude.colorScheme, 'light', 'Claude mark image must have color-scheme: light');

      await context.close();
      return marks;
    });

    // 6. Play / Pause & Clock Advancements
    await runCase('playback_clock_play_pause', 'Play/pause and no advances after pause using page.clock', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.clock.install();
      await page.goto(BASE_URL);
      await page.click('#skip-intro');

      const initialProgress = await page.evaluate(() => document.querySelector('#progress-label').textContent);
      assert.equal(initialProgress, '01 / 16', 'Playback should start at 01 / 16');

      await page.click('#play-button');
      const playingState = await page.evaluate(() => ({
        label: document.querySelector('#play-button').getAttribute('aria-label'),
        text: document.querySelector('#playback-state').textContent
      }));
      assert.equal(playingState.label, 'Pause hearing', 'Play button aria-label should switch to Pause hearing');

      await page.clock.runFor(15000);
      const advancedProgress = await page.evaluate(() => document.querySelector('#progress-label').textContent);
      assert.equal(advancedProgress, '02 / 16', 'Hearing should advance to 02 / 16 during playback');

      await page.click('#play-button');
      const pausedState = await page.evaluate(() => ({
        label: document.querySelector('#play-button').getAttribute('aria-label'),
        text: document.querySelector('#playback-state').textContent
      }));
      assert.equal(pausedState.label, 'Play hearing', 'Play button aria-label should switch back to Play hearing');

      await page.clock.runFor(30000);
      const afterPauseProgress = await page.evaluate(() => document.querySelector('#progress-label').textContent);
      assert.equal(afterPauseProgress, '02 / 16', 'Playback must not advance after being paused');

      await context.close();
      return { initialProgress, advancedProgress, afterPauseProgress };
    });

    // 7. Step Progression Chat Exactly Once, Docket, Rounds
    await runCase('step_updates_chat_docket_rounds', 'Step to each event updates chat exactly once, docket, and rounds', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let stepIndex = 2; stepIndex <= 14; stepIndex++) {
        const prevCount = await page.evaluate(() => document.querySelectorAll('#chat-log .chat-message').length);
        await page.click('#step-button');
        await settleView(page, 50);

        const currState = await page.evaluate(() => {
          const chatMessages = document.querySelectorAll('#chat-log .chat-message');
          const roundText = document.querySelector('#round').textContent;
          const progressText = document.querySelector('#progress-label').textContent;
          return {
            chatCount: chatMessages.length,
            round: parseInt(roundText, 10),
            progress: progressText
          };
        });

        assert.equal(currState.chatCount, prevCount + 1, `Step ${stepIndex}: Chat must add exactly one message`);
        assert.ok(currState.round >= 1 && currState.round <= 4, `Step ${stepIndex}: Round must stay between 1 and 4`);
      }

      await context.close();
      return { stepsVerified: 13 };
    });

    // 8. Ruling Marker Coordinated Ends AND Reset to Listening on Subsequent Non-Ruling Event
    await runCase('ruling_markers_and_reset', 'Ruling markers complete decisions and reset to LISTENING on subsequent non-ruling event', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 5; i++) {
        await page.click('#step-button');
        await settleView(page, 30);
      }

      const initialRulingState = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#court-scene .judge-marker')).map(m => ({
          status: m.querySelector('small').textContent
        }));
      });
      assert.ok(initialRulingState.every(m => m.status === 'CONSIDERING'), 'Markers must start with CONSIDERING status');

      await page.waitForTimeout(1600);

      const finalRulingState = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#court-scene .judge-marker')).map(m => ({
          perspective: m.dataset.perspective,
          decision: m.dataset.decision,
          status: m.querySelector('small').textContent,
          ariaLabel: m.getAttribute('aria-label')
        }));
      });

      assert.equal(finalRulingState.find(m => m.perspective === 'Feasibility')?.decision, 'Narrow');
      assert.equal(finalRulingState.find(m => m.perspective === 'Cost')?.decision, 'Accept');
      assert.equal(finalRulingState.find(m => m.perspective === 'Fairness')?.decision, 'Accept');
      assert.ok(finalRulingState.every(m => m.status === 'NARROW' || m.status === 'ACCEPT'), 'All markers must display resolved decision text');

      await page.click('#step-button');
      await settleView(page, 50);

      const resetMarkers = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#court-scene .judge-marker')).map(m => ({
          perspective: m.dataset.perspective,
          hasDecision: 'decision' in m.dataset,
          status: m.querySelector('small').textContent
        }));
      });

      assert.ok(resetMarkers.every(m => !m.hasDecision), 'Decision attribute must be cleared on subsequent non-ruling event');
      assert.ok(resetMarkers.every(m => m.status === 'LISTENING'), 'Marker label must reset to LISTENING on subsequent non-ruling event');

      await context.close();
      return { finalRulingState, resetMarkers };
    });

    // 9. Deadlock Event 14 Handling
    await runCase('deadlock_indicator', 'Deadlock event 14 displays deadlock status and awaits appeal', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 13; i++) {
        await page.click('#step-button');
        await settleView(page, 30);
      }

      const deadlock = await page.evaluate(() => {
        const moment = document.querySelector('#stage-moment');
        const title = document.querySelector('#moment-title');
        const label = document.querySelector('#moment-label');
        const launchItem = document.querySelector('#item-launch .item-status');
        return {
          hidden: moment.hidden,
          type: moment.dataset.type,
          title: title.textContent,
          label: label.textContent,
          launchStatus: launchItem ? launchItem.textContent : null
        };
      });

      assert.equal(deadlock.hidden, false, 'Moment banner must be visible during deadlock');
      assert.equal(deadlock.type, 'deadlock', 'Moment type must be deadlock');
      assert.equal(deadlock.title, 'Deadlock.', 'Moment title must be Deadlock.');
      assert.equal(deadlock.launchStatus, 'Awaiting Appeal', 'Launch item status must be Awaiting Appeal');

      await context.close();
      return deadlock;
    });

    // 10. Event 15 Appeal Pauses and Buttons Disabled
    await runCase('appeal_event_15_paused_disabled', 'Event 15 appeal pauses playback and disables step/play buttons', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 14; i++) {
        await page.click('#step-button');
        await settleView(page, 30);
      }

      const appeal = await page.evaluate(() => {
        return {
          panelHidden: document.querySelector('#appeal-panel').hidden,
          playDisabled: document.querySelector('#play-button').disabled,
          stepDisabled: document.querySelector('#step-button').disabled,
          playbackState: document.querySelector('#playback-state').textContent,
          sessionLabel: document.querySelector('#session-label').textContent
        };
      });

      assert.equal(appeal.panelHidden, false, 'Appeal panel must be visible at event 15');
      assert.ok(appeal.playDisabled, 'Play button must be disabled during appeal');
      assert.ok(appeal.stepDisabled, 'Step button must be disabled during appeal');
      assert.equal(appeal.sessionLabel, 'AWAITING THE OWNERS’ DECISION', 'Session label must indicate awaiting owners decision');

      await context.close();
      return appeal;
    });

    // 11. Focus Guidance: Playback -> First Appeal Choice -> Final Download
    await runCase('focus_guidance_appeal_and_verdict', 'Focus moves from playback to first appeal choice and final download', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 13; i++) {
        await page.click('#step-button');
        await settleView(page, 20);
      }

      await page.focus('#step-button');
      await page.click('#step-button');
      await settleView(page, 50);

      const focusAtAppeal = await page.evaluate(() => ({
        activeChoice: document.activeElement === document.querySelector('[data-choice="local"]'),
        tag: document.activeElement?.tagName,
        dataset: document.activeElement?.dataset?.choice
      }));

      assert.ok(focusAtAppeal.activeChoice, 'Focus must move to the first appeal choice [data-choice="local"]');

      await page.click('[data-choice="local"]');
      await settleView(page, 50);

      await page.focus('#step-button');
      await page.click('#step-button');
      await settleView(page, 50);

      const focusAtVerdict = await page.evaluate(() => ({
        activeDownload: document.activeElement === document.querySelector('#download-plan'),
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id
      }));

      assert.ok(focusAtVerdict.activeDownload, 'Focus must move to the download plan button #download-plan');

      await context.close();
      return { focusAtAppeal, focusAtVerdict };
    });

    // 12. Full-Text Paragraph Dialogue Expand / Collapse
    await runCase('dialogue_expand_collapse', 'Dialogue full text expand and collapse toggle operates properly', async () => {
      const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      await page.click('#step-button');
      await page.click('#step-button');
      await settleView(page, 50);

      const beforeExpand = await page.evaluate(() => {
        const btn = document.querySelector('#expand-dialogue');
        const body = document.querySelector('.dialogue-body');
        return {
          hidden: btn.hidden,
          expanded: btn.getAttribute('aria-expanded'),
          text: btn.textContent,
          hasExpandedClass: body.classList.contains('expanded')
        };
      });

      assert.equal(beforeExpand.hidden, false, 'Expand dialogue button must be visible when text overflows');
      assert.equal(beforeExpand.expanded, 'false', 'aria-expanded must be false initially');
      assert.equal(beforeExpand.hasExpandedClass, false, 'dialogue-body should not have expanded class initially');

      await page.click('#expand-dialogue');
      await settleView(page, 50);

      const afterExpand = await page.evaluate(() => {
        const btn = document.querySelector('#expand-dialogue');
        const body = document.querySelector('.dialogue-body');
        return {
          hidden: btn.hidden,
          expanded: btn.getAttribute('aria-expanded'),
          text: btn.textContent,
          hasExpandedClass: body.classList.contains('expanded')
        };
      });

      assert.equal(afterExpand.expanded, 'true', 'aria-expanded must be true when expanded');
      assert.equal(afterExpand.text, 'Collapse statement', 'Button text must become Collapse statement');
      assert.ok(afterExpand.hasExpandedClass, 'dialogue-body must have expanded class');

      await page.click('#expand-dialogue');
      await settleView(page, 50);

      const afterCollapse = await page.evaluate(() => {
        const btn = document.querySelector('#expand-dialogue');
        const body = document.querySelector('.dialogue-body');
        return {
          hidden: btn.hidden,
          expanded: btn.getAttribute('aria-expanded'),
          text: btn.textContent,
          hasExpandedClass: body.classList.contains('expanded')
        };
      });

      assert.equal(afterCollapse.expanded, 'false', 'aria-expanded must return to false');
      assert.equal(afterCollapse.text, 'Read full statement', 'Button text must return to Read full statement');
      assert.equal(afterCollapse.hasExpandedClass, false, 'dialogue-body must lose expanded class');

      await context.close();
      return { beforeExpand, afterExpand, afterCollapse };
    });

    // 13. Both Sample Human Choices Separately Complete, All 4 Agreed & Plan Download
    await runCase('human_choices_and_download', 'Both human choices separately complete hearing, 4 items agreed, and plan download verified', async () => {
      const choices = ['local', 'recording'];
      const results = {};

      for (const choice of choices) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
        const page = await context.newPage();
        await page.goto(BASE_URL);
        await settleView(page);
        await page.click('#skip-intro');
        await settleView(page);

        for (let i = 0; i < 14; i++) {
          await page.click('#step-button');
          await settleView(page, 20);
        }

        await page.click(`button[data-choice="${choice}"]`);
        await settleView(page, 50);

        await page.click('#step-button');
        await settleView(page, 100);

        const verdict = await page.evaluate(() => {
          return {
            verdictHidden: document.querySelector('#verdict-panel').hidden,
            agreedCount: document.querySelector('#agreed-count').textContent,
            allAgreed: Array.from(document.querySelectorAll('.item-status')).every(s => s.dataset.status === 'Agreed'),
            summary: document.querySelector('#verdict-summary').textContent
          };
        });

        assert.equal(verdict.verdictHidden, false, `Verdict panel must be visible after choosing ${choice}`);
        assert.equal(verdict.agreedCount, '4 of 4 agreed', 'All 4 items must be agreed');
        assert.ok(verdict.allAgreed, 'All items must have data-status="Agreed"');

        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.click('#download-plan')
        ]);

        const stream = await download.createReadStream();
        let markdown = '';
        for await (const chunk of stream) {
          markdown += chunk.toString();
        }

        assert.equal(download.suggestedFilename(), 'delegates-agreed-plan.md', 'Plan filename should be delegates-agreed-plan.md');
        assert.ok(markdown.includes('SCRIPTED DEMO'), 'Exported plan must contain SCRIPTED DEMO disclaimer');
        assert.ok(markdown.includes('Status: Agreed'), 'Exported plan must contain agreed status');

        results[choice] = { verdict, filename: download.suggestedFilename(), planLength: markdown.length };
        await context.close();
      }

      return results;
    });

    // 14. Restart Clears Old Choice and Chat
    await runCase('restart_clears_choice_and_chat', 'Restart clears previous choices, resets chat and docket', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 14; i++) {
        await page.click('#step-button');
        await settleView(page, 20);
      }
      await page.click('button[data-choice="local"]');
      await page.click('#step-button');
      await settleView(page, 100);

      await page.click('#restart-button');
      await settleView(page, 100);

      const restart = await page.evaluate(() => {
        return {
          progress: document.querySelector('#progress-label').textContent,
          chatCount: document.querySelectorAll('#chat-log .chat-message').length,
          agreedCount: document.querySelector('#agreed-count').textContent,
          appealHidden: document.querySelector('#appeal-panel').hidden,
          verdictHidden: document.querySelector('#verdict-panel').hidden
        };
      });

      assert.equal(restart.progress, '01 / 16', 'Restart must reset progress to 01 / 16');
      assert.equal(restart.chatCount, 1, 'Restart must reset chat log to single initial message');
      assert.equal(restart.agreedCount, '0 of 4 agreed', 'Restart must reset docket agreed tally to 0');
      assert.ok(restart.appealHidden, 'Appeal panel must be hidden after restart');
      assert.ok(restart.verdictHidden, 'Verdict panel must be hidden after restart');

      await context.close();
      return restart;
    });

    // 15. Docket Details History Preserved with Focus on Step
    await runCase('docket_details_preserved_on_step', 'Docket details open state and focus preserved when stepping', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      await page.evaluate(() => {
        const item = document.querySelector('#item-scope');
        item.open = true;
        item.querySelector('summary').focus();
      });

      await page.click('#step-button');
      await settleView(page, 50);

      const state = await page.evaluate(() => {
        const item = document.querySelector('#item-scope');
        return {
          isOpen: item.open,
          summaryActive: document.activeElement === item.querySelector('summary') || document.activeElement === document.querySelector('#step-button')
        };
      });

      assert.ok(state.isOpen, 'Docket item details must remain open when stepping');

      await context.close();
      return state;
    });

    // 16. Chat Scroll Up Preserve & New Indicator
    await runCase('chat_scroll_preserve_and_indicator', 'Chat scroll up preserves position and displays new message indicator', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      for (let i = 0; i < 5; i++) {
        await page.click('#step-button');
        await settleView(page, 30);
      }

      await page.evaluate(() => {
        const log = document.querySelector('#chat-log');
        log.scrollTop = 0;
      });
      await page.waitForTimeout(100);

      await page.click('#step-button');
      await settleView(page, 50);

      const scrolledState = await page.evaluate(() => {
        const indicator = document.querySelector('#new-messages');
        const log = document.querySelector('#chat-log');
        return {
          scrollTop: log.scrollTop,
          indicatorHidden: indicator.hidden,
          indicatorText: indicator.textContent
        };
      });

      assert.equal(scrolledState.scrollTop, 0, 'Scroll position must be preserved at top');
      assert.equal(scrolledState.indicatorHidden, false, 'New messages indicator must be visible');
      assert.ok(scrolledState.indicatorText.includes('new message'), 'Indicator must show new message text');

      await page.click('#new-messages');
      await page.waitForTimeout(100);

      const afterClick = await page.evaluate(() => {
        const indicator = document.querySelector('#new-messages');
        const log = document.querySelector('#chat-log');
        return {
          indicatorHidden: indicator.hidden,
          nearBottom: (log.scrollHeight - log.scrollTop - log.clientHeight) < 10
        };
      });

      assert.ok(afterClick.indicatorHidden, 'Indicator must hide after being clicked');
      assert.ok(afterClick.nearBottom, 'Chat log must scroll down to near bottom');

      await context.close();
      return { scrolledState, afterClick };
    });

    // 17. Participant / About Toggles
    await runCase('toggles_about_and_participants', 'About and participants panel toggles work with aria-expanded', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      await page.click('#about-button');
      const aboutOpen = await page.evaluate(() => ({
        panelHidden: document.querySelector('#about-panel').hidden,
        expanded: document.querySelector('#about-button').getAttribute('aria-expanded')
      }));
      assert.equal(aboutOpen.panelHidden, false, 'About panel should open on click');
      assert.equal(aboutOpen.expanded, 'true', 'About button aria-expanded should be true');

      await page.click('#about-button');
      const aboutClosed = await page.evaluate(() => ({
        panelHidden: document.querySelector('#about-panel').hidden,
        expanded: document.querySelector('#about-button').getAttribute('aria-expanded')
      }));
      assert.ok(aboutClosed.panelHidden, 'About panel should close on second click');
      assert.equal(aboutClosed.expanded, 'false', 'About button aria-expanded should be false');

      await page.click('#participants-button');
      const partOpen = await page.evaluate(() => ({
        panelHidden: document.querySelector('#participants').hidden,
        expanded: document.querySelector('#participants-button').getAttribute('aria-expanded')
      }));
      assert.equal(partOpen.panelHidden, false, 'Participants panel should open on click');
      assert.equal(partOpen.expanded, 'true', 'Participants button aria-expanded should be true');

      await page.click('#participants-button');
      const partClosed = await page.evaluate(() => ({
        panelHidden: document.querySelector('#participants').hidden,
        expanded: document.querySelector('#participants-button').getAttribute('aria-expanded')
      }));
      assert.ok(partClosed.panelHidden, 'Participants panel should close on second click');
      assert.equal(partClosed.expanded, 'false', 'Participants button aria-expanded should be false');

      await context.close();
      return { aboutOpen, aboutClosed, partOpen, partClosed };
    });

    // 18. Intro Replay Pauses Hearing
    await runCase('intro_replay_pauses', 'Replaying intro returns to intro and pauses active playback', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      await page.click('#play-button');
      await page.click('#about-button');
      await page.click('#replay-intro');
      await settleView(page, 100);

      const replayState = await page.evaluate(() => ({
        introHidden: document.querySelector('#intro').hidden,
        workspaceHidden: document.querySelector('#workspace').hidden,
        playAriaLabel: document.querySelector('#play-button').getAttribute('aria-label')
      }));

      assert.equal(replayState.introHidden, false, 'Intro must be displayed on replay');
      assert.ok(replayState.workspaceHidden, 'Workspace must be hidden on replay');
      assert.equal(replayState.playAriaLabel, 'Play hearing', 'Playback must be paused on intro replay');

      await context.close();
      return replayState;
    });

    // 19. Mobile Tabs All Content Accessible
    await runCase('mobile_tabs_accessibility', 'Mobile tabs expose court, chat, and docket views without inaccessible content', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page);
      await page.click('#skip-intro');
      await settleView(page);

      const isVisible = sel => page.evaluate(s => {
        const el = document.querySelector(s);
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      }, sel);

      assert.ok(await isVisible('.court-main'), 'Court main must be visible on court tab');
      assert.ok(await isVisible('.court-stage'), 'Court stage must be visible on court tab');
      assert.equal(await isVisible('.switch-panel'), false, 'Switch panel must be hidden on court tab');

      await page.click('button[data-tab="chat"]');
      await settleView(page, 50);
      assert.equal(await isVisible('.court-main'), false, 'Court main must be hidden on chat tab');
      assert.ok(await isVisible('.switch-panel'), 'Switch panel must be visible on chat tab');
      assert.ok(await isVisible('#chat-log'), 'Chat log must be visible on chat tab');

      await page.click('button[data-tab="docket"]');
      await settleView(page, 50);
      assert.ok(await isVisible('.docket'), 'Docket must be visible on docket tab');
      assert.equal(await isVisible('.court-stage'), false, 'Court stage must be hidden on docket tab');
      assert.equal(await isVisible('.switch-panel'), false, 'Switch panel must be hidden on docket tab');

      await context.close();
      return { courtTab: true, chatTab: true, docketTab: true };
    });

    // 20. Reduced Motion Intro & Runtime Preference Toggle
    await runCase('reduced_motion_behavior', 'Reduced motion disables camera animations and runtime toggle clears active motion', async () => {
      const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const pageReduced = await reducedContext.newPage();
      await pageReduced.goto(BASE_URL);
      await settleView(pageReduced);

      const introAnim = await pageReduced.evaluate(() => {
        const scene = document.querySelector('#intro-scene');
        const art = document.querySelector('.intro-art');
        return {
          animationName: window.getComputedStyle(scene).animationName,
          doorDisplay: window.getComputedStyle(art, '::before').display
        };
      });

      assert.equal(introAnim.animationName, 'none', 'Intro scene animation must be none under reduced motion');
      assert.equal(introAnim.doorDisplay, 'none', 'Door pseudo-elements must be display: none under reduced motion');
      await reducedContext.close();

      const normalContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
      const pageNormal = await normalContext.newPage();
      await pageNormal.goto(BASE_URL);
      await settleView(pageNormal);
      await pageNormal.click('#skip-intro');

      for (let i = 0; i < 5; i++) {
        await pageNormal.click('#step-button');
      }

      await pageNormal.emulateMedia({ reducedMotion: 'reduce' });
      await pageNormal.waitForTimeout(50);

      const runtimeDecisions = await pageNormal.evaluate(() => {
        return Array.from(document.querySelectorAll('#court-scene .judge-marker')).map(m => m.dataset.decision);
      });

      assert.ok(runtimeDecisions.every(d => Boolean(d)), 'Runtime media toggle to reduce must resolve all pending judge decisions immediately');

      await normalContext.close();
      return { initialAnimationNone: true, runtimeClearedMotion: true };
    });

    // 21. Screenshot Suite (with scrollTo(0,0) frame settle, desktop + mobile + 320)
    await runCase('screenshot_suite', 'Capture full-page screenshots: intro, court, ruling, appeal, verdict, docket, chat, mobile-court, mobile-chat, mobile-docket, court-320', async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await page.goto(BASE_URL);
      await settleView(page, 1000);

      const captureDocScroll = async (filename) => {
        await resetDocScrollAndSettle(page);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
      };

      await captureDocScroll('intro.png');

      await page.click('#skip-intro');
      await settleView(page, 400);
      await captureDocScroll('court.png');

      for (let i = 0; i < 5; i++) {
        await page.click('#step-button');
        await settleView(page, 50);
      }
      await page.waitForTimeout(1600);
      await captureDocScroll('ruling.png');

      await page.click('#item-scope summary');
      await settleView(page, 200);
      await captureDocScroll('docket.png');

      for (let i = 5; i < 14; i++) {
        await page.click('#step-button');
        await settleView(page, 50);
      }
      await settleView(page, 300);
      await captureDocScroll('appeal.png');

      await page.click('button[data-choice="local"]');
      await settleView(page, 100);
      await page.click('#step-button');
      await settleView(page, 300);
      await captureDocScroll('verdict.png');

      await captureDocScroll('chat.png');
      await context.close();

      const mcontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const mpage = await mcontext.newPage();
      await mpage.goto(BASE_URL);
      await settleView(mpage);
      await mpage.click('#skip-intro');
      await settleView(mpage, 300);

      const captureMobileDocScroll = async (filename) => {
        await resetDocScrollAndSettle(mpage);
        await mpage.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
      };

      await captureMobileDocScroll('mobile-court.png');

      await mpage.click('button[data-tab="chat"]');
      await settleView(mpage, 200);
      await captureMobileDocScroll('mobile-chat.png');

      await mpage.click('button[data-tab="docket"]');
      await settleView(mpage, 200);
      await captureMobileDocScroll('mobile-docket.png');
      await mcontext.close();

      const scontext = await browser.newContext({ viewport: { width: 320, height: 740 } });
      const spage = await scontext.newPage();
      await spage.goto(BASE_URL);
      await settleView(spage);
      await spage.click('#skip-intro');
      await settleView(spage, 300);

      await resetDocScrollAndSettle(spage);
      await spage.screenshot({ path: path.join(SCREENSHOT_DIR, 'court-320.png'), fullPage: true });
      await scontext.close();

      const files = [
        'intro.png', 'court.png', 'ruling.png', 'appeal.png', 'verdict.png',
        'docket.png', 'chat.png', 'mobile-court.png', 'mobile-chat.png',
        'mobile-docket.png', 'court-320.png'
      ];

      for (const f of files) {
        assert.ok(fs.existsSync(path.join(SCREENSHOT_DIR, f)), `Screenshot file ${f} must exist`);
      }

      return { generatedScreenshots: files };
    });

    // 22. Axe WCAG 2 A/AA + 2.1 AA Audits Across Intro, Court, Appeal, Verdict, Mobile Chat & Docket
    await runCase('axe_wcag_accessibility_audit', 'Run Axe WCAG 2 A/AA + 2.1 AA across desktop & mobile (explicitly scanning chat and docket tabs)', async () => {
      const formatViolation = v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map(n => ({
          target: n.target,
          failureSummary: n.failureSummary,
          html: n.html
        }))
      });

      const dContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dPage = await dContext.newPage();
      await dPage.goto(BASE_URL);
      await settleView(dPage);

      const dIntro = await new AxeBuilder({ page: dPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['desktop_intro'] = dIntro.violations.map(formatViolation);

      await dPage.click('#skip-intro');
      await settleView(dPage);

      const dCourt = await new AxeBuilder({ page: dPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['desktop_court'] = dCourt.violations.map(formatViolation);

      for (let i = 0; i < 14; i++) {
        await dPage.click('#step-button');
        await settleView(dPage, 15);
      }
      const dAppeal = await new AxeBuilder({ page: dPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['desktop_appeal'] = dAppeal.violations.map(formatViolation);

      await dPage.click('button[data-choice="local"]');
      await settleView(dPage, 30);
      await dPage.click('#step-button');
      await settleView(dPage, 30);
      const dVerdict = await new AxeBuilder({ page: dPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['desktop_verdict'] = dVerdict.violations.map(formatViolation);

      await dContext.close();

      const mContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const mPage = await mContext.newPage();
      await mPage.goto(BASE_URL);
      await settleView(mPage);

      const mIntro = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_intro'] = mIntro.violations.map(formatViolation);

      await mPage.click('#skip-intro');
      await settleView(mPage);

      const mCourt = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_court'] = mCourt.violations.map(formatViolation);

      await mPage.click('button[data-tab="chat"]');
      await settleView(mPage, 100);
      const mChat = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_chat'] = mChat.violations.map(formatViolation);

      await mPage.click('button[data-tab="docket"]');
      await settleView(mPage, 100);
      const mDocket = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_docket'] = mDocket.violations.map(formatViolation);

      await mPage.click('button[data-tab="court"]');
      await settleView(mPage, 50);
      for (let i = 0; i < 14; i++) {
        await mPage.click('#step-button');
        await settleView(mPage, 15);
      }
      const mAppeal = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_appeal'] = mAppeal.violations.map(formatViolation);

      await mPage.click('button[data-choice="local"]');
      await settleView(mPage, 30);
      await mPage.click('#step-button');
      await settleView(mPage, 30);
      const mVerdict = await new AxeBuilder({ page: mPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      testReport.axeViolations['mobile_verdict'] = mVerdict.violations.map(formatViolation);

      await mContext.close();

      let totalAxe = 0;
      for (const [key, list] of Object.entries(testReport.axeViolations)) {
        totalAxe += list.length;
        if (list.length > 0) {
          testReport.defects.push({
            category: 'accessibility',
            context: key,
            violations: list.map(v => ({ id: v.id, impact: v.impact, nodesCount: v.nodes.length, help: v.help }))
          });
        }
      }
      testReport.summary.axeViolationsCount = totalAxe;

      assert.equal(totalAxe, 0, `Expected 0 Axe WCAG violations, found ${totalAxe}`);

      return { totalAxeRulesViolated: totalAxe };
    });

  } finally {
    await browser.close();
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(testReport, null, 2), 'utf8');
    console.log(`Saved results to ${RESULTS_FILE}`);
  }

  if (testReport.summary.failed > 0) {
    process.exitCode = 1;
  }

  return testReport;
}

main().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
