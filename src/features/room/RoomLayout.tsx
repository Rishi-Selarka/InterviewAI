'use client';

// Assembles the room UI once Liveblocks Storage is ready. Holds the imperative
// editor bridge (apiRef) shared between the Problem panel (load starter) and the
// editor's Run button (read code). The right column is compact + tabbed so the
// video, integrity monitor, and evaluation tools don't crowd each other.

import { useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useStorage, useMutation } from '@liveblocks/react';
import TopBar from './TopBar';
import SessionEnded from './SessionEnded';
import ProblemPanel from '@/src/features/problems/ProblemPanel';
import EditorPanel from '@/src/features/editor/EditorPanel';
import ScoringPanel from '@/src/features/scoring/ScoringPanel';
import AIEvaluationPanel from '@/src/features/ai/AIEvaluationPanel';
import IntegrityMonitor from '@/src/features/proctoring/IntegrityMonitor';
import ProctoringAlert from '@/src/features/proctoring/ProctoringAlert';
import InterviewerControls from '@/src/features/proctoring/InterviewerControls';
import InterviewerProfileCard from './InterviewerProfileCard';
import { useCandidateProctoring } from '@/src/features/proctoring/useCandidateProctoring';
import { uploadRecordings, transcribeAndStore } from '@/src/features/transcription/process';
import type { EditorApi } from '@/src/features/editor/editorApi';
import type { RecorderApi } from '@/src/features/recording/recorderApi';
import type { Role } from './liveblocks.config';

// The VideoSDK SDK references `self` at import time, so the whole video panel must
// be client-only (never evaluated during SSR).
const VideoPanel = dynamic(() => import('@/src/features/video/VideoPanel'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-line bg-surface px-3 py-4 text-center text-xs text-muted">
      Loading video…
    </div>
  ),
});

interface Props {
  roomId: string;
  role: Role;
  name: string;
  interviewId: string;
  /** The interview owner's user id — lets the candidate view the interviewer card. */
  interviewerId?: string;
  /** No-login demo mode: skip DB persistence; scoring stays on-screen only. */
  guest?: boolean;
}

type Tab = 'ai' | 'score';
type WrapPhase = 'idle' | 'processing' | 'done' | 'error';

export default function RoomLayout({ roomId, role, name, interviewId, interviewerId, guest }: Props) {
  const apiRef = useRef<EditorApi | null>(null);
  const recorderRef = useRef<RecorderApi | null>(null);
  const [tab, setTab] = useState<Tab>('ai');
  const [showInterviewer, setShowInterviewer] = useState(false);

  // End-of-interview wrap-up (interviewer side): stop recording → upload → mark
  // ended → transcribe in-browser → store. The candidate leaves immediately; the
  // interviewer stays on a processing overlay until the transcript is saved.
  const [wrapPhase, setWrapPhase] = useState<WrapPhase>('idle');
  const [wrapStatus, setWrapStatus] = useState('');
  const [wrapError, setWrapError] = useState<string | null>(null);

  const proctoring = useCandidateProctoring();

  const ended = useStorage((root) => root.ended);
  const setEnded = useMutation(({ storage }, value: boolean) => {
    storage.set('ended', value);
  }, []);

  const isInterviewer = role === 'interviewer';

  // The ONE end action (top bar). It now does the full save pipeline so a finished
  // interview always has its recording + transcript — no separate hidden button.
  const endInterview = async () => {
    if (
      !window.confirm(
        'End the interview for both participants?\n\nThis saves the recording and ' +
          'generates the transcript. Keep this tab open while it processes (it can ' +
          'take a few minutes).',
      )
    ) {
      return;
    }

    const lookAwayCount = proctoring.lookAwayCount;
    setWrapError(null);
    setWrapStatus('Finalising recording…');
    setWrapPhase('processing');

    let blobs: { interviewer: Blob | null; candidate: Blob | null } = {
      interviewer: null,
      candidate: null,
    };
    try {
      // Stop the recorder while the video panel is still mounted, then free the
      // candidate (they go to the wrap-up screen).
      if (recorderRef.current) blobs = await recorderRef.current.stop();
      setEnded(true);

      if (blobs.interviewer || blobs.candidate) {
        setWrapStatus('Uploading audio…');
        await uploadRecordings(interviewId, blobs);
      }

      setWrapStatus('Saving interview…');
      await fetch('/api/interviews/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount }),
      });

      if (!guest && (blobs.interviewer || blobs.candidate)) {
        await transcribeAndStore(interviewId, blobs, setWrapStatus);
      }

      setWrapPhase('done');
    } catch (e) {
      setWrapError(e instanceof Error ? e.message : String(e));
      setWrapPhase('error');
      // Best-effort: make sure it's at least marked ended either way.
      setEnded(true);
      fetch('/api/interviews/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount }),
        keepalive: true,
      }).catch(() => {});
    }
  };

  // The candidate leaves the moment the interview ends. The interviewer also gets
  // the clean wrap-up screen UNLESS they're mid-processing (then the overlay below
  // keeps the room mounted so transcription can finish).
  if (ended && (!isInterviewer || wrapPhase === 'idle')) {
    return <SessionEnded role={role} />;
  }

  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col overflow-hidden bg-ink">
      <TopBar
        roomId={roomId}
        role={role}
        onEndInterview={isInterviewer ? endInterview : undefined}
      />

      {/* Loud, can't-miss integrity banner (interviewer only). */}
      {isInterviewer && <ProctoringAlert />}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LEFT: problem statement + (interviewer) search & guide */}
        <aside className="h-72 shrink-0 border-b border-line lg:h-auto lg:w-80 lg:border-b-0 lg:border-r">
          <ProblemPanel role={role} apiRef={apiRef} />
        </aside>

        {/* CENTER: shared editor + run + output */}
        <section className="flex min-h-0 flex-1 flex-col">
          <EditorPanel role={role} name={name} apiRef={apiRef} />
        </section>

        {/* RIGHT: video + (interviewer-only) integrity + evaluation tabs */}
        <aside className="flex max-h-[45vh] min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-t border-line bg-ink2 p-3 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          {/* Candidate-side look-away proctoring runs inside VideoPanel; the
              interviewer sees the resulting signal on the candidate tile. */}
          <VideoPanel roomId={roomId} role={role} name={name} recorderRef={recorderRef} guest={guest} />

          {/* Candidate can peek at the interviewer's profile (flashcard overlay). */}
          {!isInterviewer && interviewerId && (
            <button
              type="button"
              onClick={() => setShowInterviewer(true)}
              className="card flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-brand/40 hover:text-strong"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              View interviewer
            </button>
          )}

          {isInterviewer && (
            <>
              <IntegrityMonitor />

              {/* Tabbed evaluation tools — keeps the panel uncluttered. */}
              <div className="card overflow-hidden">
                <div className="flex border-b border-line">
                  <TabButton active={tab === 'ai'} onClick={() => setTab('ai')}>
                    AI Judge
                  </TabButton>
                  <TabButton active={tab === 'score'} onClick={() => setTab('score')}>
                    Your score
                  </TabButton>
                </div>
                {tab === 'ai' ? (
                  <AIEvaluationPanel apiRef={apiRef} />
                ) : (
                  <ScoringPanel interviewId={interviewId} guest={guest} />
                )}
              </div>

              {/* Headless: persists the look-away count (real interviews only).
                  The end + recording + transcript flow is the top-bar action. */}
              {!guest && <InterviewerControls interviewId={interviewId} />}
            </>
          )}
        </aside>
      </main>

      {/* Interviewer flashcard overlay (candidate-triggered). */}
      {showInterviewer && interviewerId && (
        <InterviewerProfileCard
          interviewerId={interviewerId}
          onClose={() => setShowInterviewer(false)}
        />
      )}

      {/* Interviewer wrap-up overlay — keeps the room mounted while recording is
          uploaded + transcribed, then shows the report link. */}
      {isInterviewer && wrapPhase !== 'idle' && (
        <WrapUpOverlay
          phase={wrapPhase}
          status={wrapStatus}
          error={wrapError}
          interviewId={interviewId}
        />
      )}
    </div>
  );
}

function WrapUpOverlay({
  phase,
  status,
  error,
  interviewId,
}: {
  phase: WrapPhase;
  status: string;
  error: string | null;
  interviewId: string;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/95 p-6 text-center backdrop-blur-sm">
      <div className="card max-w-sm p-8">
        {phase === 'processing' && (
          <>
            <span className="mx-auto mb-4 block h-8 w-8 animate-spin rounded-full border-2 border-line2 border-t-brand" />
            <h2 className="text-lg font-bold text-white">Wrapping up the interview…</h2>
            <p className="mt-2 text-sm text-muted">{status || 'Working…'}</p>
            <p className="mt-3 text-xs text-faint">Please keep this tab open until it finishes.</p>
          </>
        )}

        {phase === 'done' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-2xl">
              ✓
            </div>
            <h2 className="text-lg font-bold text-white">Interview saved</h2>
            <p className="mt-2 text-sm text-muted">
              The recording and transcript are stored. View the report or head back.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href={`/interviews/${interviewId}`} className="btn-primary">
                View report
              </Link>
              <Link href="/dashboard" className="btn-ghost">
                Dashboard
              </Link>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <h2 className="text-lg font-bold text-white">Interview ended</h2>
            <p className="mt-2 text-sm text-muted">
              The session ended, but saving the recording/transcript hit an issue:
            </p>
            <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
            <p className="mt-2 text-xs text-faint">
              You can re-run transcription from the interview report.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href={`/interviews/${interviewId}`} className="btn-primary">
                View report
              </Link>
              <Link href="/dashboard" className="btn-ghost">
                Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
        active ? 'bg-surface2 text-white' : 'text-muted hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  );
}
