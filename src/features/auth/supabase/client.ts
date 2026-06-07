'use client';

// Browser Supabase client (anon key) for use in client components. RLS in the
// database is what actually protects data — the anon key is safe to ship.

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
