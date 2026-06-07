'use client';

// In-browser, post-hoc transcription using transformers.js Whisper. Free, fully
// client-side (the model is downloaded once from the HF CDN and cached). No audio
// or text ever leaves the browser for transcription.

import type { TranscriptSegment } from './types';

// A small/base English Whisper model — a good speed/quality trade-off for the
// browser. Multilingual would be `Xenova/whisper-base`.
const MODEL_ID = 'Xenova/whisper-base.en';

type StatusFn = (message: string) => void;

// Cache the loaded pipeline across calls (and across both streams).
let transcriberPromise: Promise<unknown> | null = null;

async function getTranscriber(onStatus?: StatusFn): Promise<
  (audio: Float32Array, opts: Record<string, unknown>) => Promise<{
    text: string;
    chunks?: { text: string; timestamp: [number, number | null] }[];
  }>
> {
  if (!transcriberPromise) {
    onStatus?.('Loading the speech model (first run downloads ~tens of MB)…');
    transcriberPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('automatic-speech-recognition', MODEL_ID);
    })();
  }
  return transcriberPromise as Promise<
    (audio: Float32Array, opts: Record<string, unknown>) => Promise<{
      text: string;
      chunks?: { text: string; timestamp: [number, number | null] }[];
    }>
  >;
}

// Decode any browser-supported audio (webm/opus, mp4, …) to mono Float32 @ 16kHz,
// which is what Whisper expects.
async function decodeToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const Ctx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tmp = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await tmp.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    tmp.close().catch(() => {});
  }
  const frames = Math.ceil(decoded.duration * 16000);
  if (frames <= 0) return new Float32Array(0);
  const offline = new OfflineAudioContext(1, frames, 16000);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

async function toArrayBuffer(source: Blob | ArrayBuffer | string): Promise<ArrayBuffer> {
  if (typeof source === 'string') return (await fetch(source)).arrayBuffer();
  if (source instanceof Blob) return source.arrayBuffer();
  return source;
}

/**
 * Transcribe one role's audio into role-labeled, timestamped segments. Returns []
 * for empty/undecodable audio (e.g. a participant who never spoke).
 */
export async function transcribeStream(
  source: Blob | ArrayBuffer | string | null,
  role: TranscriptSegment['role'],
  onStatus?: StatusFn,
): Promise<TranscriptSegment[]> {
  if (!source) return [];
  const arrayBuffer = await toArrayBuffer(source);
  if (!arrayBuffer || arrayBuffer.byteLength === 0) return [];

  let audio: Float32Array;
  try {
    audio = await decodeToMono16k(arrayBuffer);
  } catch {
    return []; // not decodable audio
  }
  if (audio.length === 0) return [];

  const transcriber = await getTranscriber(onStatus);
  onStatus?.(`Transcribing the ${role}'s audio locally…`);
  const out = await transcriber(audio, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const chunks = out.chunks ?? [];
  const segments: TranscriptSegment[] = chunks
    .map((c) => {
      const start = c.timestamp?.[0] ?? 0;
      const end = c.timestamp?.[1] ?? start;
      return { role, text: (c.text || '').trim(), start, end };
    })
    .filter((s) => s.text.length > 0);

  if (segments.length === 0 && out.text?.trim()) {
    segments.push({ role, text: out.text.trim(), start: 0, end: 0 });
  }
  return segments;
}
