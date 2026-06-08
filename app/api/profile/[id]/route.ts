// Returns another user's PUBLIC profile (for the candidate's interviewer card).
// NOT auth-gated: candidates join as guests (no account), so they must be able to
// read the interviewer's public card. Only non-sensitive public fields are
// returned (see getPublicProfile), read via the admin path (RLS-safe).

import { getPublicProfile } from '@/src/features/auth/profile';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return Response.json({ error: 'Profile not found.' }, { status: 404 });

  return Response.json(profile);
}
