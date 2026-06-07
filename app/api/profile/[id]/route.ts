// Returns another user's PUBLIC profile (for the candidate's interviewer card).
// Auth-gated; reads via the admin path inside getPublicProfile (RLS-safe).

import { getSessionProfile, getPublicProfile } from '@/src/features/auth/profile';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionProfile();
  if (!session) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return Response.json({ error: 'Profile not found.' }, { status: 404 });

  return Response.json(profile);
}
