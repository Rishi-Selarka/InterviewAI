// Verifies the recording + post-hoc transcription pipeline:
//   1. The interviewer's client shows the "recording" indicator (recording started).
//   2. On End interview, audio is uploaded (interview audio paths set in DB) and a
//      transcripts row is created.
//
// Uses Chromium fake media (a tone), so the transcript TEXT is meaningless — we
// only assert the pipeline runs and persists. In-browser Whisper downloads a model
// on first run, so the transcript step gets a generous timeout.

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { setupInterview, login, BASE } from './lib/setup.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
};

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function pollDb(label, fn, timeoutMs, intervalMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
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

  // 1. Recording started (interviewer sees the indicator).
  await iPage.waitForSelector('text=/Recording audio/', { timeout: 45000 }).catch(() => {});
  const recording = (await iPage.locator('text=/Recording audio/').count()) > 0;
  check('Interviewer client started recording', recording);

  // Record a few seconds of (tone) audio from both participants.
  await iPage.waitForTimeout(6000);

  // 2. End interview -> upload + transcribe + store.
  iPage.once('dialog', (d) => d.accept());
  await iPage.getByRole('button', { name: /End interview/ }).click();

  // Audio upload happens before transcription, so paths should appear quickly.
  const withAudio = await pollDb(
    'audio paths',
    async () => {
      const { data } = await admin
        .from('interviews')
        .select('interviewer_audio_path, candidate_audio_path')
        .eq('id', ctx.interviewId)
        .single();
      return data && (data.interviewer_audio_path || data.candidate_audio_path) ? data : null;
    },
    90000,
  );
  check(
    'At least one audio recording uploaded (path stored)',
    !!withAudio,
    withAudio ? `i=${!!withAudio.interviewer_audio_path} c=${!!withAudio.candidate_audio_path}` : 'none',
  );

  // Verify the object actually exists in the private bucket.
  if (withAudio) {
    const path = withAudio.interviewer_audio_path || withAudio.candidate_audio_path;
    const { data: signed } = await admin.storage
      .from('recordings')
      .createSignedUrl(path, 60);
    check('Uploaded audio object is retrievable (signed URL)', !!signed?.signedUrl);
  } else {
    check('Uploaded audio object is retrievable (signed URL)', false, 'no path');
  }

  // Transcription runs in-browser (model download + inference) — generous timeout.
  console.log('… waiting for in-browser transcription to finish (downloads a model first run)…');
  const transcript = await pollDb(
    'transcript',
    async () => {
      const { data } = await admin
        .from('transcripts')
        .select('content, full_text')
        .eq('interview_id', ctx.interviewId)
        .maybeSingle();
      return data ?? null;
    },
    300000,
    5000,
  );
  check(
    'Transcript row created in DB',
    !!transcript,
    transcript ? `segments=${(transcript.content || []).length}` : 'none',
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
