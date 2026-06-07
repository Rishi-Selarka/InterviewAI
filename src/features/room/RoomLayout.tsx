'use client';

// Assembles the room UI once Liveblocks Storage is ready. Holds the imperative
// editor bridge (apiRef) shared between the Problem panel (load starter) and the
// editor's Run button (read code).

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import TopBar from './TopBar';
import ProblemPanel from '@/src/features/problems/ProblemPanel';
import EditorPanel from '@/src/features/editor/EditorPanel';
import ScoringPanel from '@/src/features/scoring/ScoringPanel';
import InterviewerControls from '@/src/features/proctoring/InterviewerControls';
import type { EditorApi } from '@/src/features/editor/editorApi';
import type { RecorderApi } from '@/src/features/recording/recorderApi';
import type { Role } from './liveblocks.config';

// The VideoSDK SDK references `self` at import time, so the whole video panel must
// be client-only (never evaluated during SSR).
const VideoPanel = dynamic(() => import('@/src/features/video/VideoPanel'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-4 text-center text-xs text-zinc-400">
      Loading video…
    </div>
  ),
});

interface Props {
  roomId: string;
  role: Role;
  name: string;
  interviewId: string;
}

export default function RoomLayout({ roomId, role, name, interviewId }: Props) {
  const apiRef = useRef<EditorApi | null>(null);
  // Interviewer-only: the dual-stream audio recorder, shared with End-interview.
  const recorderRef = useRef<RecorderApi | null>(null);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950">
      <TopBar roomId={roomId} role={role} />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LEFT: problem statement */}
        <aside className="h-72 shrink-0 border-b border-zinc-800 lg:h-auto lg:w-80 lg:border-b-0 lg:border-r">
          <ProblemPanel role={role} apiRef={apiRef} />
        </aside>

        {/* CENTER: shared editor + run + output */}
        <section className="flex min-h-0 flex-1 flex-col">
          <EditorPanel role={role} name={name} apiRef={apiRef} />
        </section>

        {/* RIGHT: video + (interviewer-only) scoring */}
        <aside className="shrink-0 overflow-auto border-t border-zinc-800 bg-zinc-900 lg:w-80 lg:border-l lg:border-t-0">
          <div className="p-3">
            {/* Candidate-side look-away proctoring runs inside VideoPanel; the
                interviewer view shows the resulting signal on the candidate tile. */}
            <VideoPanel roomId={roomId} role={role} name={name} recorderRef={recorderRef} />
          </div>
          {/* Scoring is interviewer-only — the candidate must never see it. */}
          {role === 'interviewer' && (
            <>
              <ScoringPanel interviewId={interviewId} />
              {/* Persists look-away + ends the interview (records → uploads →
                  transcribes on End). */}
              <InterviewerControls interviewId={interviewId} recorderRef={recorderRef} />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
