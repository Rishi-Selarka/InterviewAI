// Interviewer dashboard: list their interviews + create a new one. Candidates and
// HR get a short note (candidates join via invite links).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionProfile } from '@/src/features/auth/profile';
import { listInterviewsForInterviewer } from '@/src/features/interviews/server/interviews';
import NewInterviewButton from '@/src/features/interviews/NewInterviewButton';
import SignOutButton from '@/src/features/auth/SignOutButton';

const STATUS_STYLES: Record<string, string> = {
  created: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  ended: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
};

export default async function DashboardPage() {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/dashboard');

  const { profile } = session;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">IntelliInterview</span>
          <span className="ml-3 text-sm text-zinc-500">
            {profile.full_name || 'You'} · <span className="capitalize">{profile.role}</span>
          </span>
        </div>
        <SignOutButton />
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        {profile.role === 'interviewer' ? (
          <InterviewerDashboard interviewerId={session.userId} />
        ) : profile.role === 'hr' ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            HR view (interview &amp; evaluation comparison) is coming in a later
            milestone. Your role already has read access to all interviews and
            evaluations.
          </p>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              You&apos;re all set, {profile.full_name || 'candidate'}.
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Open the invite link your interviewer shared with you to join your
              interview room.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

async function InterviewerDashboard({ interviewerId }: { interviewerId: string }) {
  const interviews = await listInterviewsForInterviewer(interviewerId);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your interviews
        </h1>
        <NewInterviewButton />
      </div>

      {interviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          No interviews yet. Click <strong>New interview</strong> to create one and
          get a shareable invite link.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {interviews.map((iv) => (
            <li
              key={iv.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                    {iv.room_id}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[iv.status] ?? ''
                    }`}
                  >
                    {iv.status}
                  </span>
                  {iv.candidate_id && (
                    <span className="text-xs text-zinc-400">candidate joined</span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(iv.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/interviews/${iv.id}`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Details
                </Link>
                <Link
                  href={`/room/${iv.room_id}`}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
