'use client';

// Interviewer-only. Persists the candidate's look-away count (periodically + on
// page-hide), and runs the End-interview flow: stop recording → upload audio →
// mark ended → transcribe locally → store transcript.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCandidateProctoring } from './useCandidateProctoring';
import type { RecorderApi } from '@/src/features/recording/recorderApi';
import { uploadRecordings, transcribeAndStore } from '@/src/features/transcription/process';

const PERSIST_INTERVAL_MS = 15000;

interface Props {
  interviewId: string;
  recorderRef?: React.RefObject<RecorderApi | null>;
}

type Phase = 'idle' | 'processing' | 'done' | 'error';

export default function InterviewerControls({ interviewId, recorderRef }: Props) {
  const router = useRouter();
  const { lookAwayCount } = useCandidateProctoring();

  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = lookAwayCount;
  }, [lookAwayCount]);

  // Periodically persist the look-away count.
  useEffect(() => {
    const id = window.setInterval(() => {
      fetch('/api/proctoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount: countRef.current }),
        keepalive: true,
      }).catch(() => {});
    }, PERSIST_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [interviewId]);

  // Persist once more when the page is hidden/closed.
  useEffect(() => {
    const flush = () => {
      const payload = JSON.stringify({ interviewId, lookAwayCount: countRef.current });
      navigator.sendBeacon?.('/api/proctoring', new Blob([payload], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [interviewId]);

  const endInterview = async () => {
    if (
      !window.confirm(
        'Stop recording and save the transcript? This uploads the audio and ' +
          'transcribes it locally (may take a few minutes). Use "End interview" in ' +
          'the top bar to finish the session.',
      )
    ) {
      return;
    }
    setPhase('processing');
    setError(null);

    let blobs: { interviewer: Blob | null; candidate: Blob | null } = {
      interviewer: null,
      candidate: null,
    };
    try {
      setStatus('Finalising recording…');
      if (recorderRef?.current) blobs = await recorderRef.current.stop();

      if (blobs.interviewer || blobs.candidate) {
        setStatus('Uploading audio…');
        await uploadRecordings(interviewId, blobs);
      }

      // Mark the interview ended + persist final stats (independent of transcription).
      setStatus('Saving interview…');
      await fetch('/api/interviews/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount: countRef.current }),
      });

      if (blobs.interviewer || blobs.candidate) {
        setStatus('Transcribing locally — this may take a few minutes…');
        await transcribeAndStore(interviewId, blobs, setStatus);
      }

      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
      // Best-effort: ensure the interview is at least marked ended.
      fetch('/api/interviews/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount: countRef.current }),
      }).catch(() => {});
    }
    router.refresh();
  };

  if (phase === 'processing') {
    return (
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 p-2.5 text-xs text-zinc-300">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
          {status}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-zinc-500">
          Keep this tab open until it finishes.
        </p>
      </div>
    );
  }

  if (phase === 'done' || phase === 'error') {
    return (
      <div className="border-t border-zinc-800 p-3">
        {phase === 'error' && (
          <p className="mb-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300">
            Interview ended, but processing hit an issue: {error}. You can re-run
            transcription from the interview page.
          </p>
        )}
        {phase === 'done' && (
          <p className="mb-2 text-center text-xs text-emerald-400">
            ✓ Interview ended — audio + transcript saved.
          </p>
        )}
        <div className="flex gap-2">
          <Link
            href={`/interviews/${interviewId}`}
            className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
          >
            View interview
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-800 p-3">
      <button
        onClick={endInterview}
        className="w-full rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20"
      >
        Stop &amp; save transcript
      </button>
    </div>
  );
}
