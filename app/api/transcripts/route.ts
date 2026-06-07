// Store (upsert) the post-hoc transcript for an interview. RLS ensures only the
// owning interviewer can write it.

import { createClient } from '@/src/features/auth/supabase/server';

export const runtime = 'nodejs';

interface Segment {
  role: 'interviewer' | 'candidate';
  text: string;
  start: number;
  end: number;
}

function isSegment(x: unknown): x is Segment {
  const s = x as Segment;
  return (
    !!s &&
    (s.role === 'interviewer' || s.role === 'candidate') &&
    typeof s.text === 'string' &&
    typeof s.start === 'number' &&
    typeof s.end === 'number'
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: { interviewId?: unknown; content?: unknown; full_text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const interviewId = body.interviewId;
  if (typeof interviewId !== 'string') {
    return Response.json({ error: 'Missing interviewId.' }, { status: 400 });
  }
  const content = Array.isArray(body.content) ? body.content.filter(isSegment) : [];
  const full_text =
    typeof body.full_text === 'string'
      ? body.full_text
      : content.map((s) => `${s.role}: ${s.text}`).join('\n');

  const { error } = await supabase
    .from('transcripts')
    .upsert(
      { interview_id: interviewId, content, full_text },
      { onConflict: 'interview_id' },
    );

  if (error) return Response.json({ error: error.message }, { status: 403 });
  return Response.json({ ok: true, segments: content.length });
}
