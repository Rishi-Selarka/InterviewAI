// Candidate-facing list of interviews they can join: every scheduled or live
// interview (open-list model). Live ones are joinable now; scheduled ones show
// their time and become joinable at the session.

import Link from 'next/link';
import type { Interview } from '@/src/features/interviews/server/interviews';

function interviewDisplayName(iv: Interview): string {
  return iv.title?.trim() || `Interview ${iv.room_id}`;
}

function fmtSchedule(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CandidateInterviews({ interviews }: { interviews: Interview[] }) {
  const live = interviews.filter((i) => i.status === 'active');
  const upcoming = interviews.filter((i) => i.status === 'scheduled');

  if (interviews.length === 0) {
    return (
      <div className="card border-dashed p-10 text-center">
        <p className="text-sm text-muted">
          No interviews available yet. When an interviewer schedules or starts one,
          it&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {live.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-strong">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Live now
          </h2>
          <ul className="flex flex-col gap-2.5">
            {live.map((iv) => (
              <Row key={iv.id} iv={iv} live />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-strong">Upcoming interviews</h2>
        {upcoming.length === 0 ? (
          <div className="card border-dashed p-8 text-center">
            <p className="text-sm text-muted">No upcoming interviews scheduled.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {upcoming.map((iv) => (
              <Row key={iv.id} iv={iv} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ iv, live }: { iv: Interview; live?: boolean }) {
  return (
    <li className="card card-hover flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-strong">{interviewDisplayName(iv)}</span>
          {live ? (
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Live now
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brandbright">
              Scheduled
            </span>
          )}
        </div>
        <span className="mt-0.5 block text-xs text-faint">
          {live ? 'In progress — you can join now' : fmtSchedule(iv.scheduled_at)}
        </span>
      </div>
      <Link href={`/room/${iv.room_id}`} className="btn-primary shrink-0 px-4 py-1.5 text-sm">
        {live ? 'Join now →' : 'Join'}
      </Link>
    </li>
  );
}
