import 'server-only';

// Server Supabase client (anon key, RLS-enforced) bound to the request cookies,
// for use in server components and route handlers. This is the user's session —
// it acts AS the logged-in user, so RLS applies.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only. Safe to
            // ignore — the middleware refreshes the session cookies instead.
          }
        },
      },
    },
  );
}
