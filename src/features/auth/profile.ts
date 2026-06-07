import 'server-only';

// Server-side helpers for the authenticated user + their profile.

import { createClient } from './supabase/server';

export type UserRole = 'interviewer' | 'candidate' | 'hr';

export interface Profile {
  id: string;
  full_name: string;
  username: string;
  role: UserRole;
  headline: string;
  bio: string;
  linkedin_url: string;
  github_url: string;
  website_url: string;
  avatar_url: string;
}

const PROFILE_COLUMNS =
  'id, full_name, username, role, headline, bio, linkedin_url, github_url, website_url, avatar_url';

/** A human display name, derived even if the profile is sparse. */
export function displayName(
  profile: Pick<Profile, 'full_name' | 'username'> | null,
  email?: string | null,
): string {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split('@')[0] ||
    'User'
  );
}

/**
 * Returns the logged-in user's id/email + profile, or null if not authenticated.
 * Uses getUser() (verifies the JWT). If the profile row is somehow missing (the
 * signup trigger didn't fire), returns a sensible in-memory fallback derived from
 * the auth user so the app never bounces a logged-in user back to /login.
 */
export async function getSessionProfile(): Promise<
  { userId: string; email: string | null; profile: Profile } | null
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  const email = user.email ?? null;

  const profile: Profile = data
    ? (data as Profile)
    : {
        id: user.id,
        full_name:
          (user.user_metadata?.full_name as string) ||
          (user.user_metadata?.name as string) ||
          email?.split('@')[0] ||
          'User',
        username: email?.split('@')[0] ?? '',
        role: 'candidate',
        headline: '',
        bio: '',
        linkedin_url: '',
        github_url: '',
        website_url: '',
        avatar_url:
          (user.user_metadata?.avatar_url as string) ||
          (user.user_metadata?.picture as string) ||
          '',
      };

  return { userId: user.id, email, profile };
}
