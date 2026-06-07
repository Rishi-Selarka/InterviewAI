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
      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface2 hover:text-strong"
    >
      Sign out
    </button>
  );
}
