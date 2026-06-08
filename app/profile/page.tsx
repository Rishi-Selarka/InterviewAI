// Profile settings page — server component.
// Loads the session + hosted interview count, then delegates edits to ProfileForm.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getSessionProfile,
  displayName,
} from '@/src/features/auth/profile';
import { countInterviewsForInterviewer } from '@/src/features/interviews/server/interviews';
import Logo from '@/src/features/brand/Logo';
import ProfileForm from '@/src/features/auth/ProfileForm';
import ThemeToggle from '@/src/features/ui/ThemeToggle';
import SignOutButton from '@/src/features/auth/SignOutButton';

export default async function ProfilePage() {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/profile');

  const { userId, email, profile } = session;
  const hosted = await countInterviewsForInterviewer(userId);
  const name = displayName(profile, email);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-ink">
      {/* Top bar */}
      <header className="border-b border-line bg-ink2/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3.5">
          <Logo href="/" markClassName="h-7 w-7" textClassName="text-base" />
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <SignOutButton className="rounded-xl border border-line2 bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface2 hover:text-strong" />
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-xl border border-line2 bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-strong"
            >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        {/* Profile header card */}
        <div className="card p-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Avatar */}
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={name}
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-line2"
              />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand2 to-brand text-2xl font-bold text-onbrand ring-2 ring-line2">
                {initial}
              </span>
            )}

            {/* Identity */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight text-strong">{name}</h1>

              {profile.username && (
                <p className="mt-0.5 text-sm text-muted">@{profile.username}</p>
              )}

              {email && (
                <p className="mt-1 text-sm text-faint">{email}</p>
              )}

              {profile.headline && (
                <p className="mt-2 text-sm text-fg">{profile.headline}</p>
              )}
            </div>

            {/* Stat */}
            <div className="card shrink-0 bg-surface2 px-5 py-3 text-center">
              <div className="text-2xl font-bold text-strong">{hosted}</div>
              <div className="mt-0.5 text-xs text-muted">Interviews hosted</div>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <ProfileForm initial={profile} email={email} />
      </main>
    </div>
  );
}
