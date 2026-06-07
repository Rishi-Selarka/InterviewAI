// Permanently delete the signed-in user's account. Deleting the auth user
// cascades to their profile + interviews (ON DELETE CASCADE foreign keys).

import { getSessionProfile } from '@/src/features/auth/profile';
import { createAdminClient } from '@/src/features/auth/supabase/admin';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) return Response.json({ error: error.message }, { status: 502 });

  return Response.json({ ok: true });
}
