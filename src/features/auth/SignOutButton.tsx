'use client';

import { useRouter } from 'next/navigation';
import { createClient } from './supabase/client';

export default function SignOutButton() {
  const router = useRouter();
  const handle = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };
  return (
    <button
      onClick={handle}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      Sign out
    </button>
  );
}
