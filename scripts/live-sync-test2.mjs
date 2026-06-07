// Second deep test: interviewer-driven synced controls.
//   1. Switching the active problem syncs the problem title to the candidate.
//   2. "Load starter code into editor" populates the shared editor (both sides).
//   3. Changing the language syncs to the candidate's language selector.
//   4. The candidate has NO problem-switch dropdown (interviewer-only control).

import { chromium } from 'playwright';
import { setupInterview, login, BASE } from './lib/setup.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
};

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
try {
  const ctxOpts = { permissions: ['camera', 'microphone'] };
  const iPage = await (await browser.newContext(ctxOpts)).newPage();
  const cPage = await (await browser.newContext(ctxOpts)).newPage();
  // Auto-accept the "replace editor contents?" confirm dialog.
  iPage.on('dialog', (d) => d.accept());

  const ctx = await setupInterview();
  await login(iPage, ctx.interviewer);
  await login(cPage, ctx.candidate);
  await iPage.goto(`${BASE}/room/${ctx.roomId}`);
  await cPage.goto(`${BASE}/room/${ctx.roomId}`);
  await iPage.waitForSelector('.monaco-editor', { timeout: 30000 });
  await cPage.waitForSelector('.monaco-editor', { timeout: 30000 });
  await iPage.waitForTimeout(2000);

  // 1. Switch active problem (interviewer) -> candidate title updates.
  // Problem select is the first <select> in the left panel; choose the Secure one.
  const problemSelect = iPage.locator('aside select').first();
  await problemSelect.selectOption('secure-backup-command');
  await cPage.waitForTimeout(2500);
  const cTitle = await cPage.locator('h1').first().innerText();
  check('Problem switch syncs to candidate', /command injection/i.test(cTitle), `candidate h1="${cTitle}"`);

  // 2. Load starter code -> editor contains the problem's starter (both sides).
  await iPage.getByRole('button', { name: /Load starter code/ }).click();
  await iPage.waitForTimeout(2500);
  const readEditor = (page) =>
    page.evaluate(() => {
      const m = window.monaco;
      if (m && m.editor.getModels().length) return m.editor.getModels()[0].getValue();
      return Array.from(document.querySelectorAll('.view-line')).map((l) => l.textContent).join('\n');
    });
  const iCode = await readEditor(iPage);
  const cCode = await readEditor(cPage);
  check('Load starter populates interviewer editor', /buildBackupCommand/.test(iCode));
  check('Loaded starter syncs to candidate editor', /buildBackupCommand/.test(cCode));

  // 3. Language change syncs to candidate's language selector.
  const iLangSelect = iPage.locator('section select').first();
  await iLangSelect.selectOption('python');
  await cPage.waitForTimeout(2500);
  const cLang = await cPage.locator('section select').first().inputValue();
  check('Language change syncs to candidate', cLang === 'python', `candidate lang="${cLang}"`);

  // 4. Candidate has no problem-switch dropdown in the left panel.
  const cProblemSelects = await cPage.locator('aside select').count();
  check('Candidate has no problem-switch control', cProblemSelects === 0, `count=${cProblemSelects}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
