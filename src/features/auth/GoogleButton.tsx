'use client';

// "Continue with Google" button. Starts the Supabase OAuth flow, sending the user
// to Google and back to /auth/callback (which exchanges the code for a session).
//
// On the signup page we pass `signupRole` so the choice (interviewer/candidate) is
// carried through the redirect in a short-lived cookie and applied in the callback
// — Google never asks for a role, so without this every Google user defaults to
// candidate.

import { useState } from 'react';
import { createClient } from './supabase/client';
import type { Role } from '@/src/features/room/liveblocks.config';

export default function GoogleButton({
  next,
  signupRole,
}: {
  next: string;
  signupRole?: Role;
}) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    if (signupRole) {
      // Read by app/auth/callback/route.ts. Lax + short-lived; cleared after use.
      document.cookie = `ii_signup_role=${signupRole}; path=/; max-age=600; samesite=lax`;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates to Google, so we only get here on error.
    if (error) setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:bg-surface2 disabled:opacity-60"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
        />
      </svg>
      {busy ? 'Redirecting…' : 'Continue with Google'}
    </button>
  );
}
