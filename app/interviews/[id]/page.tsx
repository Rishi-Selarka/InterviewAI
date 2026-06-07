// Interview detail view: stored transcript (role-labeled conversation) + audio
// playback via signed URLs, plus a re-run-transcription action for the
// interviewer. Access is RLS-scoped (interviewer/candidate/hr).

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/src/features/auth/supabase/server';
import { signRecording } from '@/src/features/recording/server/storage';
import TranscriptView from '@/src/features/transcription/TranscriptView';
import type { TranscriptSegment } from '@/src/features/transcription/types';

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
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted">
        Interview not found, or you don&apos;t have access to it.{' '}
        <Link href="/dashboard" className="ml-1 text-brandbright underline">
          Dashboard
        </Link>
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
    supabase.from('transcripts').select('content, full_text, created_at').eq('interview_id', id).maybeSingle(),
    supabase.from('proctoring_stats').select('look_away_count').eq('interview_id', id).maybeSingle(),
    supabase.from('evaluations').select('average, created_at').eq('interview_id', id).order('created_at', { ascending: false }),
    signRecording(interview.interviewer_audio_path),
    signRecording(interview.candidate_audio_path),
  ]);

  const segments = (transcript?.content ?? []) as TranscriptSegment[];
  const canRerun = interview.interviewer_id === user.id;
  const hasAudio = !!(interviewerUrl || candidateUrl);

  return (
    <div data-theme="dark" className="flex flex-1 flex-col bg-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted hover:text-white">
            ← Dashboard
          </Link>
          <span className="font-mono text-sm text-zinc-100">Interview {interview.room_id}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
            {interview.status}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        {/* Quick facts */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Look-aways" value={String(proctoring?.look_away_count ?? '—')} />
          <Fact
            label="Latest score"
            value={evals && evals.length > 0 ? `${evals[0].average} / 5` : '—'}
          />
          <Fact
            label="Ended"
            value={interview.ended_at ? new Date(interview.ended_at).toLocaleString() : '—'}
          />
        </div>

        <TranscriptView
          interviewId={id}
          initialSegments={segments}
          audio={{ interviewer: interviewerUrl, candidate: candidateUrl }}
          canRerun={canRerun}
          hasAudio={hasAudio}
          hasTranscript={!!transcript}
        />
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
