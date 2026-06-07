// Shared test setup: programmatically create an interviewer + candidate user and
// an interview row (via the Supabase service role), and a UI login helper. Used
// by the auth-adapted Playwright suites.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './env.mjs';

loadEnv();

export const BASE = process.env.BASE_URL || 'http://localhost:3000';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const PASSWORD = 'Test-password-123';

async function createUser(supabase, fullName, role, tag) {
  const email = `${role}-${tag}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (error) throw new Error(`createUser(${role}): ${error.message}`);
  return { id: data.user.id, email, password: PASSWORD };
}

/**
 * Create two fresh users + an interview owned by the interviewer. Returns the
 * credentials, roomId and interviewId.
 */
export async function setupInterview() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  const supabase = admin();
  const tag = Math.random().toString(36).slice(2, 8);

  const interviewer = await createUser(supabase, 'Interviewer', 'interviewer', tag);
  const candidate = await createUser(supabase, 'Candidate', 'candidate', tag);

  const roomId = 'e2e-' + tag;
  const { data, error } = await supabase
    .from('interviews')
    .insert({ room_id: roomId, interviewer_id: interviewer.id, status: 'created' })
    .select('id, room_id')
    .single();
  if (error) throw new Error(`create interview: ${error.message}`);

  return { interviewer, candidate, roomId: data.room_id, interviewId: data.id };
}

/** Log a user in through the real /login UI so SSR cookies get set. */
export async function login(page, creds) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', creds.email);
  await page.fill('input[type=password]', creds.password);
  await page.click('button[type=submit]');
  // Land on the dashboard (default next) before continuing.
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => {});
}
