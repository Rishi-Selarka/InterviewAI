// Interview detail view: stored transcript (role-labeled conversation) + audio
// playback via signed URLs, plus a re-run-transcription action for the
// interviewer. Access is RLS-scoped (interviewer/candidate/hr).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/src/features/auth/supabase/server';
import { signRecording } from '@/src/features/recording/server/storage';
import TranscriptView from '@/src/features/transcription/TranscriptView';
import type { TranscriptSegment } from '@/src/features/transcription/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StatusKind = 'created' | 'active' | 'ended' | string;

function StatusPill({ status }: { status: StatusKind }) {
  const map: Record<string, string> = {
    created: 'bg-zinc-700 text-zinc-300',
    active: 'bg-emerald-900/60 text-emerald-300',
    ended: 'bg-brand/20 text-brandbright',
  };
  const cls = map[status] ?? 'bg-zinc-700 text-zinc-400';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
      <span
        className={`text-sm font-semibold text-strong ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold text-strong">{children}</h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-6 py-8 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/interviews/${id}`)}`);

  // RLS decides whether this user may read the interview.
  const { data: interview } = await supabase
    .from('interviews')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!interview) {
    return (
      <div
        data-theme="dark"
        className="flex min-h-screen flex-1 flex-col items-center justify-center bg-ink p-6"
      >
        <div className="card w-full max-w-sm p-8 text-center">
          <p className="mb-1 text-base font-semibold text-strong">
            Interview not found
          </p>
          <p className="mb-6 text-sm text-muted">
            This interview doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link href="/dashboard" className="btn-primary text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Fetch all page data in one parallel batch (no request waterfall).
  const [
    { data: transcript },
    { data: proctoring },
    { data: evals },
    interviewerUrl,
    candidateUrl,
  ] = await Promise.all([
    supabase
      .from('transcripts')
      .select('content, full_text, created_at')
      .eq('interview_id', id)
      .maybeSingle(),
    supabase
      .from('proctoring_stats')
      .select('look_away_count')
      .eq('interview_id', id)
      .maybeSingle(),
    supabase
      .from('evaluations')
      .select('average, created_at')
      .eq('interview_id', id)
      .order('created_at', { ascending: false }),
    signRecording(interview.interviewer_audio_path),
    signRecording(interview.candidate_audio_path),
  ]);

  const segments = (transcript?.content ?? []) as TranscriptSegment[];
  const canRerun = interview.interviewer_id === user.id;
  const hasAudio = !!(interviewerUrl || candidateUrl);

  // Derived display values
  const interviewName =
    interview.title?.trim() || `Interview ${interview.room_id}`;
  const latestScore =
    evals && evals.length > 0 ? `${evals[0].average} / 5` : '—';
  const candidateStatus =
    interview.candidate_id ? 'Joined' : 'Not joined';

  return (
    <div data-theme="dark" className="flex min-h-screen flex-1 flex-col bg-ink">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-line bg-ink/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-4 px-6 py-4">
          {/* Left: back + title */}
          <div className="flex flex-col gap-1">
            <Link
              href="/dashboard"
              className="btn-ghost w-fit text-xs text-muted hover:text-fg"
            >
              ← Dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-strong">{interviewName}</h1>
              <StatusPill status={interview.status} />
            </div>
            <span className="font-mono text-xs text-faint">
              Room&nbsp;
              <span className="text-muted">{interview.room_id}</span>
            </span>
          </div>

          {/* Right: open room CTA — only while the interview is still joinable.
              An ended room can't be reopened, so showing it there is misleading. */}
          {interview.status !== 'ended' && (
            <Link
              href={`/room/${interview.room_id}`}
              className="btn-primary shrink-0 whitespace-nowrap text-sm"
            >
              Open Room →
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-10 px-6 py-8">
        {/* ── Summary Grid ───────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Overview</SectionHeading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <SummaryCard label="Status" value={<StatusPill status={interview.status} />} />
            <SummaryCard label="Created" value={fmtDate(interview.created_at)} />
            <SummaryCard label="Started" value={fmtDate(interview.started_at)} />
            <SummaryCard label="Ended" value={fmtDate(interview.ended_at)} />
            <SummaryCard label="Candidate" value={candidateStatus} />
            <SummaryCard label="Look-aways" value={String(proctoring?.look_away_count ?? '—')} />
            <SummaryCard label="Latest Score" value={latestScore} />
            <SummaryCard label="Room Code" value={interview.room_id} mono />
          </div>
        </section>

        {/* ── Recordings ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Recordings</SectionHeading>
          {hasAudio ? (
            <div className="space-y-4">
              {interviewerUrl && (
                <div className="card p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                    Interviewer
                  </p>
                  <audio controls src={interviewerUrl} className="w-full" />
                </div>
              )}
              {candidateUrl && (
                <div className="card p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
                    Candidate
                  </p>
                  <audio controls src={candidateUrl} className="w-full" />
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="No recording was captured for this interview." />
          )}
        </section>

        {/* ── Transcript ─────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Transcript</SectionHeading>
          {segments.length > 0 || transcript ? (
            <TranscriptView
              interviewId={id}
              initialSegments={segments}
              audio={{ interviewer: interviewerUrl, candidate: candidateUrl }}
              canRerun={canRerun}
              hasAudio={hasAudio}
              hasTranscript={!!transcript}
            />
          ) : (
            <EmptyState message="No transcript is available yet. Transcription runs after the interview ends." />
          )}
        </section>
      </main>
    </div>
  );
}
