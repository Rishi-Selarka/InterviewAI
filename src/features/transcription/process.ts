'use client';

// Client-side orchestration for recordings + transcription, shared by the
// End-interview flow and the "re-run transcription" button on the detail view.

import { transcribeStream } from './whisper';
import { mergeSegments, toFullText } from './mergeTranscript';

type StatusFn = (message: string) => void;

/**
 * Ask the server to transcribe the interview's stored audio via a cloud Whisper
 * endpoint (reliable, no tab-open needed). Returns:
 *   'ok'          — transcript generated + stored server-side
 *   'unavailable' — no server transcriber configured; caller should fall back to
 *                   the in-browser model.
 * Throws on a real server error.
 */
export async function tryServerTranscribe(
  interviewId: string,
): Promise<'ok' | 'unavailable'> {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewId }),
  });
  if (res.ok) return 'ok';
  if (res.status === 501) return 'unavailable';
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || `Server transcription failed (${res.status}).`);
}

/** Upload both audio blobs to the server (which stores them via the service role). */
export async function uploadRecordings(
  interviewId: string,
  blobs: { interviewer: Blob | null; candidate: Blob | null },
): Promise<void> {
  const form = new FormData();
  form.append('interviewId', interviewId);
  if (blobs.interviewer) form.append('interviewer', blobs.interviewer, 'interviewer.webm');
  if (blobs.candidate) form.append('candidate', blobs.candidate, 'candidate.webm');
  const res = await fetch('/api/recordings', { method: 'POST', body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Recording upload failed.');
  }
}

/**
 * Transcribe both audio sources (Blob or signed URL) in the browser, merge into
 * one ordered transcript, and store it. Returns the number of segments.
 */
export async function transcribeAndStore(
  interviewId: string,
  sources: { interviewer: Blob | string | null; candidate: Blob | string | null },
  onStatus?: StatusFn,
): Promise<number> {
  const interviewerSegs = await transcribeStream(sources.interviewer, 'interviewer', onStatus);
  const candidateSegs = await transcribeStream(sources.candidate, 'candidate', onStatus);
  const content = mergeSegments(interviewerSegs, candidateSegs);
  const full_text = toFullText(content);

  onStatus?.('Saving the transcript…');
  const res = await fetch('/api/transcripts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interviewId, content, full_text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Saving the transcript failed.');
  }
  return content.length;
}
