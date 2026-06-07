// Landing page. Entry points now go through real auth: interviewers manage
// interviews from the dashboard; candidates join via an invite link (which sends
// them to log in / sign up first).

import Link from 'next/link';
import { getSessionProfile } from '@/src/features/auth/profile';

export default async function Home() {
  const session = await getSessionProfile();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          IntelliInterview
        </h1>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
          Live technical interviews with a smart coding room.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Log in
              </Link>
            </>
          )}
        </div>

        <p className="mt-3 text-sm text-zinc-500">
          Interviewers create interviews and share an invite link. Candidates open
          the link to join.
        </p>

        <p className="mt-10 text-xs text-zinc-400 dark:text-zinc-600">
          Just want to code?{' '}
          <Link href="/interview" className="underline hover:text-zinc-600 dark:hover:text-zinc-400">
            Open the solo coding pad
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
