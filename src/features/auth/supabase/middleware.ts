// Refreshes the Supabase auth session on every request and keeps the auth
// cookies in sync between the browser and server. Based on the current
// @supabase/ssr Next.js guidance: do not run logic between creating the client
// and calling getUser(), and always return the same response object whose cookies
// were written, or sessions can silently break.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Is Supabase actually configured (vs. missing / placeholder demo values)? When it
// isn't, we skip the per-request auth refresh entirely — otherwise every page
// navigation would wait on a failing network call to a non-existent Supabase host.
function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return Boolean(url) && Boolean(key) && !url.includes('placeholder') && !key.includes('placeholder');
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // No-login demo (or Supabase not set up): nothing to refresh.
  if (!supabaseConfigured()) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to refresh the token if needed.
  await supabase.auth.getUser();

  return supabaseResponse;
}
