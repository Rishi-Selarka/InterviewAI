// OAuth (Google) callback. Supabase redirects here with a one-time `code` after
// the user approves on Google's consent screen. We exchange it for a session
// (sets the auth cookies), optionally apply the role the user chose on the signup
// page, then bounce to the original `next` target.
//
// Required for any provider/PKCE flow with @supabase/ssr — without this route the
// browser is left holding a `code` it can't turn into a session.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/src/features/auth/supabase/server';
import { safeNext } from '@/src/features/auth/safeNext';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // The DB trigger creates every new user as 'candidate'. If they picked a role on
  // the signup page before clicking "Continue with Google", honor it here. The
  // role-lock trigger allows candidate <-> interviewer (but never hr).
  const cookieStore = await cookies();
  const desiredRole = cookieStore.get('ii_signup_role')?.value;
  if (desiredRole === 'interviewer' || desiredRole === 'candidate') {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ role: desiredRole }).eq('id', user.id);
    }
    cookieStore.delete('ii_signup_role');
  }

  // In production behind a proxy (e.g. Vercel) the public host is in
  // x-forwarded-host; `origin` would be the internal address. Use it for the
  // redirect so we land on the real domain.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;
  return NextResponse.redirect(`${base}${next}`);
}
