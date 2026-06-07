// Refreshes the Supabase auth session on every request and keeps the auth
// cookies in sync between the browser and server. Based on the current
// @supabase/ssr Next.js guidance: do not run logic between creating the client
// and calling getUser(), and always return the same response object whose cookies
// were written, or sessions can silently break.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
