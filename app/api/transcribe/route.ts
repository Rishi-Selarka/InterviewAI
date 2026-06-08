// Server-side transcription: download the stored audio, transcribe via a cloud
// Whisper endpoint, and store the role-labeled transcript. Only the owning
// interviewer may trigger it. Returns 501 if no server transcriber is configured
// so the client can fall back to the in-browser model.

import { getSessionProfile } from '@/src/features/auth/profile';
import { getInterviewById } from '@/src/features/interviews/server/interviews';
import { downloadRecording } from '@/src/features/recording/server/storage';
import {
  serverTranscriberConfigured,
  transcribeBuffer,
} from '@/src/features/transcription/server/transcribe';
import { createAdminClient } from '@/src/features/auth/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface Segment {
  role: 'interviewer' | 'candidate';
  text: string;
  start: number;
  end: number;
}

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  if (!serverTranscriberConfigured()) {
    // No cloud transcriber configured — the client should use the in-browser model.
    return Response.json({ error: 'not_configured' }, { status: 501 });
  }

  let body: { interviewId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const interviewId = body.interviewId;
  if (typeof interviewId !== 'string') {
    return Response.json({ error: 'Missing interviewId.' }, { status: 400 });
  }

  const interview = await getInterviewById(interviewId);
  if (!interview) return Response.json({ error: 'Interview not found.' }, { status: 404 });
  if (interview.interviewer_id !== session.userId) {
    return Response.json({ error: 'Only the interviewer can transcribe.' }, { status: 403 });
  }

  const sources = [
    { role: 'interviewer' as const, path: interview.interviewer_audio_path },
    { role: 'candidate' as const, path: interview.candidate_audio_path },
  ];

  const segments: Segment[] = [];
  try {
    for (const src of sources) {
      const file = await downloadRecording(src.path);
      if (!file || file.bytes.byteLength === 0) continue;
      const { segments: segs } = await transcribeBuffer(file.bytes, `${src.role}.webm`, file.mime);
      for (const s of segs) segments.push({ role: src.role, ...s });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  if (segments.length === 0) {
    return Response.json({ error: 'No speech detected in the recordings.' }, { status: 422 });
  }

  // Interleave both speakers by time.
  segments.sort((a, b) => a.start - b.start);
  const full_text = segments.map((s) => `${s.role}: ${s.text}`).join('\n');

  const admin = createAdminClient();
  const { error } = await admin
    .from('transcripts')
    .upsert({ interview_id: interviewId, content: segments, full_text }, { onConflict: 'interview_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, segments: segments.length });
}
