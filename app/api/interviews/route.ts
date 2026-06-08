// Create a new interview (interviewer only). Mints the room id + VideoSDK meeting
// id and inserts the interviews row.

import { getSessionProfile } from '@/src/features/auth/profile';
import { createInterview } from '@/src/features/interviews/server/interviews';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  // Any authenticated user can host an interview. Role in a room is derived from
  // ownership (creator => interviewer; whoever opens the invite => candidate).

  let title = '';
  let scheduledAt: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.title === 'string') title = body.title;
    if (typeof body?.scheduledAt === 'string' && body.scheduledAt.trim()) {
      scheduledAt = body.scheduledAt;
    }
  } catch {
    /* no body => untitled, unscheduled */
  }

  try {
    const interview = await createInterview(session.userId, title, scheduledAt);
    return Response.json({
      id: interview.id,
      roomId: interview.room_id,
      status: interview.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
