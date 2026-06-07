import { chromium } from 'playwright';
import { setupInterview, login, BASE } from './lib/setup.mjs';

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const opts = { permissions: ['camera', 'microphone'] };
const iPage = await (await browser.newContext(opts)).newPage();
const cPage = await (await browser.newContext(opts)).newPage();
iPage.on('console', (m) => console.log(`[i ${m.type()}]`, m.text().slice(0, 240)));
iPage.on('pageerror', (e) => console.log('[i PAGEERROR]', e.message.split('\n')[0]));
iPage.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/recordings') || u.includes('/api/transcripts') || u.includes('/api/interviews/end'))
    console.log('[i RESP]', r.status(), u.replace(BASE, ''));
});

const ctx = await setupInterview();
await login(iPage, ctx.interviewer);
await login(cPage, ctx.candidate);
await iPage.goto(`${BASE}/room/${ctx.roomId}`);
await cPage.goto(`${BASE}/room/${ctx.roomId}`);

await iPage.waitForSelector('text=/Recording audio/', { timeout: 45000 }).catch(() => {});
console.log('recording indicator:', await iPage.locator('text=/Recording audio/').count());

// Probe the recorder + audio graph state from the page.
await iPage.waitForTimeout(6000);

iPage.once('dialog', (d) => d.accept());
await iPage.getByRole('button', { name: /End interview/ }).click();
// Watch the processing status text for ~30s.
for (let i = 0; i < 12; i++) {
  await iPage.waitForTimeout(2500);
  const txt = await iPage.locator('aside').last().innerText().catch(() => '');
  const status = txt.split('\n').filter((l) => /Finalising|Uploading|Saving|Transcrib|issue|ended/i.test(l));
  if (status.length) console.log('[status]', status.join(' | ').slice(0, 200));
}
await browser.close();
