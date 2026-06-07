// Signup is merged into the single login page (create-or-sign-in). Keep this
// route as a redirect so old links / bookmarks still work.

import { redirect } from 'next/navigation';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
}
