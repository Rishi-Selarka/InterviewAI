import type { NextRequest } from 'next/server';
import { updateSession } from '@/src/features/auth/supabase/middleware';

// Next.js 16 renamed the "middleware" convention to "proxy"; the behaviour is
// identical. This refreshes the Supabase auth session cookie on every request.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all paths except static assets. Route handlers ARE included so they
  // receive refreshed session cookies.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
