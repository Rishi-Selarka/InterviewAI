'use client';

import { useRouter } from 'next/navigation';
import { createClient } from './supabase/client';

export default function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const handle = async () => {
    await createClient().auth.signOut();
    // Back to the splash/landing (not the sign-in form) after signing out.
    router.push('/');
    router.refresh();
  };
  return (
    <button
      onClick={handle}
      className={
        className ??
        'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-rose-500 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600'
      }
    >
      Sign out
    </button>
  );
}
