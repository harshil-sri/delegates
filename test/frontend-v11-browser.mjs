import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const requireQA = createRequire(process.env.QA_MODULES || '/tmp/opencode/delegates-qa/package.json');
const { chromium } = requireQA('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const demoUrl = new URL('/?demo=1', base).href;
const output = fileURLToPath(new URL('../design-review/v1.1/implementation', import.meta.url));
const resultsPath = fileURLToPath(new URL('../docs/frontend-v11-browser-results.json', import.meta.url));
const checks = [];
const failures = [];
await mkdir(output, { recursive: true });

async function check(name, run) {
  try {
    await run();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    failures.push(error);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

try {
  await check('Four real camera beats, layered parallax, and seven-second entry', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    try {
      const defaultPage = await context.newPage();
      await defaultPage.goto(base);
      await defaultPage.locator('#skip-intro').click();
      await defaultPage.waitForURL(url => url.pathname.includes('court.html'));
      assert.equal(new URL(defaultPage.url()).pathname, '/court.html');
      await defaultPage.close();

      await page.goto(demoUrl);
      await page.waitForFunction(() => document.querySelector('#intro').classList.contains('is-running'));
      const animations = await page.locator('#intro').evaluate(el => el.getAnimations({ subtree: true }).map(animation => animation.animationName));
      assert.ok(animations.includes('camera-journey'));
      assert.ok(animations.includes('foreground-journey'));
      assert.equal(await page.locator('#enter-court').isVisible(), false);
      const transforms = [];
      for (const [beat, name] of [['0', 'threshold'], ['1', 'bench'], ['2', 'advocates'], ['3', 'wide']]) {
        await page.waitForFunction(value => document.querySelector('#intro').dataset.beat === value, beat);
        await page.screenshot({ path: `${output}/intro-${name}.png` });
        transforms.push(await page.locator('#intro-scene').evaluate(el => getComputedStyle(el).transform));
        assert.equal(await page.locator('#skip-intro').isVisible(), true);
      }
      assert.ok(new Set(transforms).size >= 3);
      await page.locator('#enter-court').waitFor({ state: 'visible' });
      await page.screenshot({ path: `${output}/intro-ready.png` });
      await page.locator('#enter-court').click();
      assert.equal(await page.locator('#workspace').isVisible(), true);
      assert.equal(await page.locator('#main').evaluate(el => el === document.activeElement), true);
    } finally { await context.close(); }
  });

  await check('Runtime reduced motion skips remaining intro and replay preserves hearing', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(demoUrl);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => document.querySelector('#intro').dataset.beat === '3');
      assert.equal(await page.locator('#enter-court').isVisible(), true);
      assert.equal(await page.locator('#intro-scene').evaluate(el => getComputedStyle(el).animationName), 'none');
      await page.locator('#skip-intro').click();
      await page.locator('#step-button').click();
      const progress = await page.locator('#progress-label').textContent();
      await page.locator('#about-button').click();
      await page.locator('#replay-intro').click();
      assert.equal(await page.locator('#enter-court').isVisible(), true);
      await page.locator('#enter-court').click();
      assert.equal(await page.locator('#progress-label').textContent(), progress);
    } finally { await context.close(); }
  });

  await check('Visible complete figures, unclipped advocate captions, and changed-item focus', async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.goto(demoUrl);
      await page.locator('#skip-intro').click();
      await page.waitForFunction(() => document.querySelectorAll('#court-scene .judge').length === 3);
      const metrics = await page.evaluate(() => {
        const stage = document.querySelector('.court-stage').getBoundingClientRect();
        return [...document.querySelectorAll('.advocate-caption')].map(el => el.getBoundingClientRect().bottom <= stage.bottom + 1);
      });
      assert.ok(metrics.every(Boolean), 'Advocate state captions must be entirely visible');
      const ids = await page.locator('svg [id]').evaluateAll(elements => elements.map(el => el.id));
      assert.equal(new Set(ids).size, ids.length, 'Inline scene rig IDs must not collide');
      for (let index = 0; index < 3; index++) await page.locator('#step-button').click();
      await page.locator('#locate-item').click();
      assert.equal(await page.locator('#item-scope summary').evaluate(el => el === document.activeElement), true);
      assert.ok(await page.locator('#item-scope .item-wording').textContent());
      assert.match(await page.locator('#item-scope .item-owner').textContent(), /Round 1/);
      await page.screenshot({ path: `${output}/changed-item.png` });
    } finally { await context.close(); }
  });
} finally {
  await browser.close();
  await writeFile(resultsPath, JSON.stringify({ checks, passed: checks.length - failures.length, failed: failures.length }, null, 2) + '\n');
}
if (failures.length) process.exitCode = 1;
