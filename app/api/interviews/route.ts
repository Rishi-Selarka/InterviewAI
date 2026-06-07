// Create a new interview (interviewer only). Mints the room id + VideoSDK meeting
// id and inserts the interviews row.

import { getSessionProfile } from '@/src/features/auth/profile';
import { createInterview } from '@/src/features/interviews/server/interviews';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSessionProfile();
  if (!session) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (session.profile.role !== 'interviewer') {
    return Response.json(
      { error: 'Only interviewers can create interviews.' },
      { status: 403 },
    );
  }

  try {
    const interview = await createInterview(session.userId);
    return Response.json({ id: interview.id, roomId: interview.room_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
