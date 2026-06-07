// Upsert the candidate's look-away count for an interview. Called periodically by
// the interviewer's client. RLS ensures only the owning interviewer can write.

import { createClient } from '@/src/features/auth/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: { interviewId?: unknown; lookAwayCount?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const interviewId = body.interviewId;
  const lookAwayCount = Number(body.lookAwayCount);
  if (typeof interviewId !== 'string' || !Number.isFinite(lookAwayCount)) {
    return Response.json({ error: 'Missing interviewId or lookAwayCount.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('proctoring_stats')
    .upsert(
      {
        interview_id: interviewId,
        look_away_count: Math.max(0, Math.round(lookAwayCount)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'interview_id' },
    );

  if (error) return Response.json({ error: error.message }, { status: 403 });
  return Response.json({ ok: true });
}
