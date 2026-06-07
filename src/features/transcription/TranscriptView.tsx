'use client';

// Renders the role-labeled transcript as a conversation, plays the two audio
// recordings via signed URLs, and (for the interviewer) re-runs transcription
// in the browser.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TranscriptSegment } from './types';
import { transcribeAndStore } from './process';

interface Props {
  interviewId: string;
  initialSegments: TranscriptSegment[];
  audio: { interviewer: string | null; candidate: string | null };
  canRerun: boolean;
  hasAudio: boolean;
  hasTranscript: boolean;
}

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TranscriptView({
  interviewId,
  initialSegments,
  audio,
  canRerun,
  hasAudio,
  hasTranscript,
}: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'running' | 'error'>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rerun = async () => {
    setPhase('running');
    setError(null);
    try {
      await transcribeAndStore(
        interviewId,
        { interviewer: audio.interviewer, candidate: audio.candidate },
        setStatus,
      );
      router.refresh();
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Audio playback */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recordings</h2>
        {hasAudio ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <AudioCard label="Interviewer" url={audio.interviewer} />
            <AudioCard label="Candidate" url={audio.candidate} />
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No audio was recorded for this interview.</p>
        )}
      </section>

      {/* Re-run control (interviewer only) */}
      {canRerun && hasAudio && (
        <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          {phase === 'running' ? (
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              {status || 'Transcribing locally, this may take a few minutes…'}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {hasTranscript ? 'Re-run transcription in your browser.' : 'No transcript yet.'}
              </span>
              <button
                onClick={rerun}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                {hasTranscript ? 'Re-run transcription' : 'Transcribe now'}
              </button>
            </div>
          )}
          {phase === 'error' && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">Failed: {error}</p>
          )}
        </section>
      )}

      {/* Transcript conversation */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Transcript</h2>
        {initialSegments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            No transcript yet.
            {canRerun && hasAudio
              ? ' Use “Transcribe now” above.'
              : ' It will appear here once transcription has run.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {initialSegments.map((s, i) => (
              <li
                key={i}
                className={`flex gap-3 rounded-lg border p-2.5 text-sm ${
                  s.role === 'interviewer'
                    ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
                }`}
              >
                <span className="w-20 shrink-0">
                  <span
                    className={`block text-xs font-semibold capitalize ${
                      s.role === 'interviewer'
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {s.role}
                  </span>
                  <span className="text-[10px] text-zinc-400">{fmt(s.start)}</span>
                </span>
                <span className="text-zinc-800 dark:text-zinc-200">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AudioCard({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</div>
      {url ? (
        <audio controls src={url} className="w-full" />
      ) : (
        <p className="text-xs text-zinc-400">No recording.</p>
      )}
    </div>
  );
}
