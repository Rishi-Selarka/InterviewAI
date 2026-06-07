// Persist an interviewer's evaluation. Uses the user's RLS-scoped client, so the
// database itself enforces that only the owning interviewer can write it.

import { createClient } from '@/src/features/auth/supabase/server';

export const runtime = 'nodejs';

const FIELDS = [
  'problem_solving',
  'code_quality',
  'debugging',
  'efficiency',
  'communication',
] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const interviewId = body.interviewId;
  if (typeof interviewId !== 'string') {
    return Response.json({ error: 'Missing interviewId.' }, { status: 400 });
  }

  // Validate and collect the five 1-5 scores.
  const scores: Record<string, number> = {};
  for (const f of FIELDS) {
    const v = Number(body[f]);
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      return Response.json({ error: `Invalid score for ${f}.` }, { status: 400 });
    }
    scores[f] = v;
  }
  const average =
    FIELDS.reduce((sum, f) => sum + scores[f], 0) / FIELDS.length;
  const notes = typeof body.notes === 'string' ? body.notes : '';

  const { data, error } = await supabase
    .from('evaluations')
    .insert({
      interview_id: interviewId,
      ...scores,
      average: Math.round(average * 100) / 100,
      notes,
      submitted_by: user.id,
    })
    .select('id, average')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  return Response.json({ id: data.id, average: data.average });
}
