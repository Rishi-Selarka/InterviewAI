// Deep end-to-end test of the live interview room.
//
// Opens TWO independent browser contexts (interviewer + candidate) pointed at the
// same room and verifies the real collaborative behaviour:
//   1. Both connect (presence shows the other participant).
//   2. Editor text typed by the interviewer appears in the candidate's editor.
//   3. The interviewer's language change syncs to the candidate.
//   4. Running code shows the same output on both sides.
//   5. The scoring panel is visible to the interviewer but NOT the candidate.
//
// Run with the dev server already up on http://localhost:3000:
//   node scripts/live-sync-test.mjs
//
// This is a dev-only manual test harness, not part of the build.

import { chromium } from 'playwright';
import { setupInterview, login, BASE } from './lib/setup.mjs';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
}

async function waitForMonaco(page) {
  // Monaco renders into .monaco-editor; wait until it's mounted and editable.
  await page.waitForSelector('.monaco-editor', { timeout: 30000 });
  await page.waitForTimeout(1500); // let Yjs bind + initial sync settle
}

async function getEditorText(page) {
  // Prefer Monaco's model API (exact text); fall back to the rendered lines.
  return page.evaluate(() => {
    const m = window.monaco;
    if (m && m.editor.getModels().length) {
      return m.editor.getModels()[0].getValue();
    }
    const lines = Array.from(document.querySelectorAll('.view-line'));
    return lines.map((l) => l.textContent).join('\n');
  });
}

async function typeInEditor(page, text) {
  await page.locator('.monaco-editor').first().click();
  // Select-all + delete, then type fresh content.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press('Delete');
  await page.keyboard.type(text, { delay: 5 });
}

// Poll until the editor on `page` contains `needle` (cross-client sync helper).
async function waitForEditorContains(page, needle, timeout = 20000) {
  await page
    .waitForFunction(
      (n) => {
        const m = window.monaco;
        const txt =
          m && m.editor.getModels().length
            ? m.editor.getModels()[0].getValue()
            : Array.from(document.querySelectorAll('.view-line'))
                .map((l) => l.textContent)
                .join('\n');
        return txt.includes(n);
      },
      needle,
      { timeout },
    )
    .catch(() => {});
}

// Fake camera/mic so the room's auto-joining video works headlessly and doesn't
// block the collaboration checks.
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const ctxOpts = { permissions: ['camera', 'microphone'] };
  const interviewer = await browser.newContext(ctxOpts);
  const candidate = await browser.newContext(ctxOpts);
  const iPage = await interviewer.newPage();
  const cPage = await candidate.newPage();

  iPage.on('console', (m) => m.type() === 'error' && console.log('[i-console]', m.text()));
  cPage.on('console', (m) => m.type() === 'error' && console.log('[c-console]', m.text()));

  // Create users + interview, log both in, then open the room (role from DB).
  const ctx = await setupInterview();
  await login(iPage, ctx.interviewer);
  await login(cPage, ctx.candidate);
  await iPage.goto(`${BASE}/room/${ctx.roomId}`);
  await cPage.goto(`${BASE}/room/${ctx.roomId}`);

  await waitForMonaco(iPage);
  await waitForMonaco(cPage);

  // 1. Presence: each should eventually see the other participant's role label.
  await iPage.waitForSelector('text=Candidate', { timeout: 20000 }).catch(() => {});
  const iSeesCandidate = await iPage.locator('text=Candidate').count();
  check('Interviewer sees the candidate in presence', iSeesCandidate > 0);

  const cSeesInterviewer = await cPage.locator('text=Interviewer').count();
  check('Candidate sees the interviewer in presence', cSeesInterviewer > 0);

  // Wait until cross-client Yjs sync is established: the interviewer seeds the
  // default problem's starter, so the candidate should receive "BUG" before we
  // start typing. Typing before sync would let concurrent edits interleave.
  await waitForEditorContains(cPage, 'BUG', 25000);

  // 2. Editor text sync: interviewer types, candidate receives.
  const marker = `// synced ${Date.now()}\nconsole.log("hello from interviewer");`;
  await typeInEditor(iPage, marker);
  await waitForEditorContains(cPage, 'hello from interviewer', 15000);
  const cText = (await getEditorText(cPage)) || '';
  check(
    'Editor text syncs interviewer → candidate',
    cText.includes('hello from interviewer'),
    `candidate editor starts: ${JSON.stringify(cText.slice(0, 40))}`,
  );

  // 3. Reverse sync: candidate types, interviewer receives. Use a deterministic
  // snippet that prints 42.
  await typeInEditor(cPage, '// candidate edit\nconsole.log(42);');
  await waitForEditorContains(iPage, 'candidate edit', 15000);
  const iText = (await getEditorText(iPage)) || '';
  check(
    'Editor text syncs candidate → interviewer',
    iText.includes('candidate edit'),
    `interviewer editor starts: ${JSON.stringify(iText.slice(0, 40))}`,
  );

  // 4. Run output: ensure the run-relevant code has fully synced to the
  // interviewer, then Run; both should show "42" in the OUTPUT panel (targeted by
  // testid so a dev console-overlay <pre> can't false-match).
  await waitForEditorContains(iPage, 'console.log(42', 15000);
  await iPage.getByRole('button', { name: /Run/ }).click();
  const out = iPage.getByTestId('run-output');
  await out.filter({ hasText: '42' }).waitFor({ timeout: 15000 }).catch(() => {});
  const iOut = await out.innerText();
  await cPage.getByTestId('run-output').filter({ hasText: '42' }).waitFor({ timeout: 10000 }).catch(() => {});
  const cOut = await cPage.getByTestId('run-output').innerText();
  check('Run produces correct output (42) for runner', iOut.includes('42'), `out=${JSON.stringify(iOut)}`);
  check('Run output syncs to the other participant', cOut.includes('42'), `out=${JSON.stringify(cOut)}`);

  // 5. Scoring panel visibility (interviewer-only).
  const iHasScoring = await iPage.locator('text=Submit Evaluation').count();
  const cHasScoring = await cPage.locator('text=Submit Evaluation').count();
  check('Interviewer sees the scoring panel', iHasScoring > 0);
  check('Candidate does NOT see the scoring panel', cHasScoring === 0);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
