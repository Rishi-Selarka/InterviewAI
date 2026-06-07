import 'server-only';

// Server-side helpers for the authenticated user + their profile.

import { createClient } from './supabase/server';
import type { Role } from '@/src/features/room/liveblocks.config';

export interface Profile {
  id: string;
  full_name: string;
  role: Role | 'hr';
}

/**
 * Returns the logged-in user's id/email + profile, or null if not authenticated.
 * Uses getUser() (verifies the JWT) rather than getSession().
 */
export async function getSessionProfile(): Promise<
  { userId: string; email: string | null; profile: Profile } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, email: user.email ?? null, profile: profile as Profile };
}
