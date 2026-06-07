// End an interview: mark it ended + stamp ended_at, and persist the final
// look-away count. Designed to also work from navigator.sendBeacon on unload, so
// it tolerates a text/plain body. RLS ensures only the owning interviewer writes.

import { createClient } from '@/src/features/auth/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  // sendBeacon sends a Blob; read as text and parse leniently.
  let body: { interviewId?: unknown; lookAwayCount?: unknown } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    /* ignore — treat as empty */
  }

  const interviewId = body.interviewId;
  if (typeof interviewId !== 'string') {
    return Response.json({ error: 'Missing interviewId.' }, { status: 400 });
  }

  // Persist the final look-away count if provided.
  const lookAwayCount = Number(body.lookAwayCount);
  if (Number.isFinite(lookAwayCount)) {
    await supabase.from('proctoring_stats').upsert(
      {
        interview_id: interviewId,
        look_away_count: Math.max(0, Math.round(lookAwayCount)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'interview_id' },
    );
  }

  const { error } = await supabase
    .from('interviews')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', interviewId);

  if (error) return Response.json({ error: error.message }, { status: 403 });
  return Response.json({ ok: true });
}
