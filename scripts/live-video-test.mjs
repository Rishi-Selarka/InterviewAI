// Deep test of the VideoSDK video panel with two real browser clients.
//   1. Both participants join the SAME meeting and each sees TWO tiles
//      (local + remote) — i.e. the two browsers actually connect to each other.
//   2. Each side shows the other participant's name on a video tile.
//   3. Camera toggle works (turning the local camera off removes its <video>).
//   4. Leave shows a "Rejoin video" affordance, and rejoining reconnects.
//
// Uses Chromium fake camera/mic so it runs headlessly. Requires the dev server
// up and valid VideoSDK credentials in .env.local.

import { chromium } from 'playwright';
import { setupInterview, login, BASE } from './lib/setup.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
};

async function waitForTiles(page, count, timeout = 45000) {
  // Each camera-on tile renders one <video>; wait until `count` are present.
  await page
    .waitForFunction((n) => document.querySelectorAll('video').length >= n, count, { timeout })
    .catch(() => {});
  return page.locator('video').count();
}

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const opts = { permissions: ['camera', 'microphone'] };
  const iPage = await (await browser.newContext(opts)).newPage();
  const cPage = await (await browser.newContext(opts)).newPage();

  iPage.on('console', (m) => m.type() === 'error' && console.log('[i]', m.text().slice(0, 160)));

  const ctx = await setupInterview();
  await login(iPage, ctx.interviewer);
  await login(cPage, ctx.candidate);
  await iPage.goto(`${BASE}/room/${ctx.roomId}`);
  await cPage.goto(`${BASE}/room/${ctx.roomId}`);

  // 1. Two-way connection: each page should reach 2 video tiles.
  const iTiles = await waitForTiles(iPage, 2);
  const cTiles = await waitForTiles(cPage, 2);
  check('Interviewer sees 2 video tiles (self + candidate)', iTiles >= 2, `tiles=${iTiles}`);
  check('Candidate sees 2 video tiles (self + interviewer)', cTiles >= 2, `tiles=${cTiles}`);

  // 2. Names on tiles (scope to the video aside to avoid the top-bar presence).
  const iNames = await iPage.locator('aside').last().innerText();
  const cNames = await cPage.locator('aside').last().innerText();
  check('Interviewer tile area names the candidate', /Candidate/.test(iNames));
  check('Candidate tile area names the interviewer', /Interviewer/.test(cNames));

  // 3. Camera toggle: turning the interviewer camera off drops a <video>.
  const before = await iPage.locator('video').count();
  await iPage.getByTitle(/Turn camera off/).click();
  await iPage.waitForTimeout(2500);
  const after = await iPage.locator('video').count();
  check('Turning camera off removes the local video', after < before, `before=${before} after=${after}`);
  // Turn it back on for cleanliness.
  await iPage.getByTitle(/Turn camera on/).click().catch(() => {});

  // 4. Leave + rejoin.
  await iPage.getByRole('button', { name: /^Leave$/ }).click();
  await iPage.waitForSelector('text=Rejoin video', { timeout: 10000 });
  check('Leaving shows a Rejoin control', true);
  await iPage.getByRole('button', { name: /Rejoin video/ }).click();
  const rejoinTiles = await waitForTiles(iPage, 2);
  check('Rejoining reconnects to the meeting', rejoinTiles >= 2, `tiles=${rejoinTiles}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
