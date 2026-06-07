'use client';

// Assembles the room UI once Liveblocks Storage is ready. Holds the imperative
// editor bridge (apiRef) shared between the Problem panel (load starter) and the
// editor's Run button (read code). The right column is compact + tabbed so the
// video, integrity monitor, and evaluation tools don't crowd each other.

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStorage, useMutation } from '@liveblocks/react';
import TopBar from './TopBar';
import SessionEnded from './SessionEnded';
import ProblemPanel from '@/src/features/problems/ProblemPanel';
import EditorPanel from '@/src/features/editor/EditorPanel';
import ScoringPanel from '@/src/features/scoring/ScoringPanel';
import AIEvaluationPanel from '@/src/features/ai/AIEvaluationPanel';
import IntegrityMonitor from '@/src/features/proctoring/IntegrityMonitor';
import InterviewerControls from '@/src/features/proctoring/InterviewerControls';
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
  /** No-login demo mode: skip DB persistence; scoring stays on-screen only. */
  guest?: boolean;
}

type Tab = 'ai' | 'score';

export default function RoomLayout({ roomId, role, name, interviewId, guest }: Props) {
  const apiRef = useRef<EditorApi | null>(null);
  const recorderRef = useRef<RecorderApi | null>(null);
  const [tab, setTab] = useState<Tab>('ai');

  const ended = useStorage((root) => root.ended);
  const setEnded = useMutation(({ storage }, value: boolean) => {
    storage.set('ended', value);
  }, []);

  // Both participants see a clean wrap-up once the interviewer ends the session.
  if (ended) return <SessionEnded role={role} />;

  const isInterviewer = role === 'interviewer';

  return (
    <div data-theme="dark" className="flex h-[100dvh] flex-col overflow-hidden bg-ink">
      <TopBar
        roomId={roomId}
        role={role}
        onEndInterview={isInterviewer ? () => setEnded(true) : undefined}
      />

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
        <aside className="flex shrink-0 flex-col gap-3 overflow-auto border-t border-line bg-ink2 p-3 lg:w-80 lg:border-l lg:border-t-0">
          {/* Candidate-side look-away proctoring runs inside VideoPanel; the
              interviewer sees the resulting signal on the candidate tile. */}
          <VideoPanel roomId={roomId} role={role} name={name} recorderRef={recorderRef} guest={guest} />

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

              {/* DB-backed end+transcribe flow (real interviews only). */}
              {!guest && (
                <InterviewerControls interviewId={interviewId} recorderRef={recorderRef} />
              )}
            </>
          )}
        </aside>
      </main>
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
