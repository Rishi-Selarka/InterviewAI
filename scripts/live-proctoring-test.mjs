// Light test that the assistive-proctoring channel exists and initialises, and
// (best-effort) that the end-to-end look-away pipeline runs.
//
// We cannot simulate a real human head with a fake camera, so the HARD checks are:
//   1. The interviewer sees the candidate's neutral "Looked away: N times"
//      indicator — proving the candidate published proctoring state via presence
//      and the interviewer received + rendered it.
//   2. The candidate's own view shows the subtle "Attention check active" hint and
//      is NOT blocked/warned.
// Soft (logged, non-failing): with a non-face fake camera, MediaPipe should treat
// it as "no face" and, after the debounce, the count should climb.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
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
  const opts = { permissions: ['camera', 'microphone'] };
  const iPage = await (await browser.newContext(opts)).newPage();
  const cPage = await (await browser.newContext(opts)).newPage();

  const ctx = await setupInterview();
  await login(iPage, ctx.interviewer);
  await login(cPage, ctx.candidate);
  await iPage.goto(`${BASE}/room/${ctx.roomId}`);
  await cPage.goto(`${BASE}/room/${ctx.roomId}`);

  // 1. Interviewer sees the look-away indicator for the candidate (channel init).
  const indicator = iPage.locator('text=/Looked away:/').first();
  await indicator.waitFor({ timeout: 40000 }).catch(() => {});
  const hasIndicator = (await iPage.locator('text=/Looked away:/').count()) > 0;
  check('Interviewer sees the candidate look-away indicator (channel initialised)', hasIndicator);

  // 2. Candidate sees the subtle self-hint and is not blocked.
  const hasSelfHint = (await cPage.locator('text=Attention check active').count()) > 0;
  check('Candidate sees a subtle, non-punitive self-hint', hasSelfHint);
  // The candidate must still have the working editor (not blocked by proctoring).
  await cPage.waitForSelector('.monaco-editor', { timeout: 30000 }).catch(() => {});
  const candidateCanEdit = (await cPage.locator('.monaco-editor').count()) > 0;
  check('Candidate is NOT blocked — editor still present', candidateCanEdit);

  // 3. Interviewer must NOT see any punitive "cheating" wording.
  const aside = await iPage.locator('aside').last().innerText();
  check('Wording is neutral (no "cheat"/"cheating")', !/cheat/i.test(aside));

  // Soft: did the look-away pipeline actually advance the count? (non-face cam)
  await iPage.waitForTimeout(6000);
  const text = await iPage.locator('text=/Looked away:/').first().innerText().catch(() => '');
  const m = text.match(/Looked away:\s*(\d+)/);
  const count = m ? Number(m[1]) : -1;
  console.log(`(soft) interviewer indicator now reads: ${JSON.stringify(text)} -> count=${count}`);

  // 4. PERSISTENCE: interviewer submits an evaluation, then ends the interview.
  await iPage.getByRole('button', { name: /Submit Evaluation/ }).click();
  await iPage.waitForSelector('text=/Evaluation saved/', { timeout: 25000 }).catch(() => {});
  const evalSavedUi = (await iPage.locator('text=/Evaluation saved/').count()) > 0;
  check('Evaluation submit shows saved confirmation', evalSavedUi);

  iPage.once('dialog', (d) => d.accept()); // confirm() on End interview
  await iPage.getByRole('button', { name: /^End interview$/ }).click();
  await iPage.waitForSelector('text=/Interview ended/', { timeout: 15000 }).catch(() => {});

  // Verify rows landed in the database (service role read).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data: evalRows } = await admin
    .from('evaluations')
    .select('average')
    .eq('interview_id', ctx.interviewId);
  check('Evaluation row persisted to DB', (evalRows?.length ?? 0) > 0, `rows=${evalRows?.length ?? 0}`);

  const { data: procRow } = await admin
    .from('proctoring_stats')
    .select('look_away_count')
    .eq('interview_id', ctx.interviewId)
    .maybeSingle();
  check('proctoring_stats row persisted to DB', !!procRow, `look_away_count=${procRow?.look_away_count}`);

  const { data: ivRow } = await admin
    .from('interviews')
    .select('status, started_at, ended_at')
    .eq('id', ctx.interviewId)
    .single();
  check('Interview marked ended with timestamps', ivRow?.status === 'ended' && !!ivRow?.ended_at && !!ivRow?.started_at,
    `status=${ivRow?.status} started=${!!ivRow?.started_at} ended=${!!ivRow?.ended_at}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
