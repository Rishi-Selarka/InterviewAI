import 'server-only';

// Server-side transcription via a cloud Whisper endpoint (OpenAI-compatible).
// Reliable + fast, and runs AFTER upload so the interviewer needn't keep the tab
// open. Enabled by ONE env var — preferring Groq (free, fast whisper-large-v3):
//   GROQ_API_KEY     -> https://api.groq.com/openai/v1/audio/transcriptions
//   OPENAI_API_KEY   -> https://api.openai.com/v1/audio/transcriptions
// If neither is set, callers fall back to the in-browser model.

const GROQ_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

export function serverTranscriberConfigured(): boolean {
  return Boolean(GROQ_KEY || OPENAI_KEY);
}

export interface TimedSegment {
  text: string;
  start: number;
  end: number;
}

export async function transcribeBuffer(
  bytes: ArrayBuffer,
  filename: string,
  mime: string,
): Promise<{ text: string; segments: TimedSegment[] }> {
  const useGroq = Boolean(GROQ_KEY);
  const endpoint = useGroq
    ? 'https://api.groq.com/openai/v1/audio/transcriptions'
    : 'https://api.openai.com/v1/audio/transcriptions';
  const key = useGroq ? GROQ_KEY : OPENAI_KEY;
  const model = useGroq ? 'whisper-large-v3' : 'whisper-1';

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime || 'audio/webm' }), filename);
  form.append('model', model);
  form.append('response_format', 'verbose_json');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Transcription API ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    text?: string;
    segments?: { text: string; start: number; end: number }[];
  };
  const segments: TimedSegment[] = (data.segments ?? [])
    .map((s) => ({ text: (s.text || '').trim(), start: s.start ?? 0, end: s.end ?? 0 }))
    .filter((s) => s.text.length > 0);

  const text = data.text?.trim() || segments.map((s) => s.text).join(' ');
  return { text, segments };
}
