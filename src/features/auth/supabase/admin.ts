import 'server-only';

// PRIVILEGED Supabase client using the SERVICE ROLE key. This BYPASSES Row Level
// Security, so it must NEVER be imported into client code. The `server-only`
// import above makes a client-side import a build error.
//
// Use it only for trusted server-side operations that legitimately need to act
// beyond a single user's RLS scope — e.g. a candidate claiming their seat on an
// interview row they don't yet own, or reading/creating the VideoSDK meeting id.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
