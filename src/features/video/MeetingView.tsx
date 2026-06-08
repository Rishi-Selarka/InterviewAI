'use client';

// The live meeting UI rendered INSIDE our room's video panel. Custom layout:
// stacked participant tiles + a compact control bar. Auto-joins on mount (via the
// MeetingProvider) and tracks join/leave so we can show "Connecting…" and a
// rejoin affordance.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMeeting } from '@videosdk.live/react-sdk';
import ParticipantTile from './ParticipantTile';
import CandidateProctor from '@/src/features/proctoring/CandidateProctor';
import { useCandidateProctoring } from '@/src/features/proctoring/useCandidateProctoring';
import InterviewAudioRecorder from '@/src/features/recording/InterviewAudioRecorder';
import type { RecorderApi } from '@/src/features/recording/recorderApi';
import type { Role } from '@/src/features/room/liveblocks.config';

type MeetingState = 'connecting' | 'joined' | 'left';

interface Props {
  /** Viewer's role — candidate runs proctoring; interviewer displays it. */
  role: Role;
  /** Forwarded to the local tile so proctoring can later read camera frames. */
  onLocalWebcamTrack?: (track: MediaStreamTrack | null) => void;
  /** Interviewer-only: populated with the dual-stream audio recorder controls. */
  recorderRef?: React.RefObject<RecorderApi | null>;
  /** No-login demo mode: skip audio recording. */
  guest?: boolean;
}

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function IconMicOn() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm-2 6a5 5 0 0010 0h1.5a6.5 6.5 0 01-13 0H5zm5 8a1 1 0 01-1-1v-1.5a1 1 0 012 0V17a1 1 0 01-1 1z" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M9.293 2.293a1 1 0 011.414 0l.3.3A3 3 0 0113 5.586V10a3 3 0 01-.17 1.006l1.665 1.665A4.978 4.978 0 0015 10h1.5a6.5 6.5 0 01-2.9 5.394l1.253 1.253a1 1 0 01-1.414 1.414L2.293 3.707a1 1 0 011.414-1.414l5.586 5.586V4a3 3 0 011-2.293zM5 10a4.978 4.978 0 00.766 2.67L4.512 11.416A6.44 6.44 0 013.5 10H5zm5 8a1 1 0 01-1-1v-1.5a1 1 0 012 0V17a1 1 0 01-1 1z" />
    </svg>
  );
}

function IconCameraOn() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2 6a2 2 0 012-2h9a2 2 0 012 2v2.5l3-2v7l-3-2V14a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function IconCameraOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M2.293 2.293a1 1 0 011.414 0L18 16.586a1 1 0 01-1.414 1.414l-2.14-2.14A2 2 0 0113 16H4a2 2 0 01-2-2V6c0-.195.028-.383.081-.562L2.293 3.707a1 1 0 010-1.414zM18 5.5l-3 2V6a2 2 0 00-2-2h-.086L18 9.086V5.5z" />
    </svg>
  );
}

function IconHangUp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path
        fillRule="evenodd"
        d="M2.25 6.108a13.5 13.5 0 0115.5 0 .75.75 0 01.25.569v1.5a.75.75 0 01-.75.75h-2a.75.75 0 01-.75-.75v-.687a11.008 11.008 0 00-9.5 0v.687a.75.75 0 01-.75.75h-2a.75.75 0 01-.75-.75v-1.5a.75.75 0 01.25-.569z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MeetingView({ role, onLocalWebcamTrack, recorderRef, guest }: Props) {
  const router = useRouter();
  const [state, setState] = useState<MeetingState>('connecting');

  // Interviewer reads the candidate's broadcast look-away state (no-op data for
  // the candidate's own view; the hook is cheap and always called).
  const candidateProctoring = useCandidateProctoring();

  const {
    join,
    leave,
    toggleMic,
    toggleWebcam,
    localMicOn,
    localWebcamOn,
    localParticipant,
    participants,
  } = useMeeting({
    onMeetingJoined: () => setState('joined'),
    onMeetingLeft: () => setState('left'),
  });

  // The `participants` map includes EVERYONE, the local participant too. Render
  // tiles from it (local first) — do not also render localParticipant separately,
  // or the local tile shows up twice. Initial join is handled by the provider
  // (joinWithoutUserInteraction); join() below only reconnects after a Leave.
  const localId = localParticipant?.id;
  const allIds = [...participants.keys()];
  const orderedIds = localId
    ? [localId, ...allIds.filter((id) => id !== localId)]
    : allIds;
  const remoteCount = orderedIds.filter((id) => id !== localId).length;

  // Track whether the other participant has EVER joined, so we can show a clear
  // "left the call" message (vs. "waiting to join") when they disconnect.
  const [otherEverJoined, setOtherEverJoined] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (remoteCount > 0 && !otherEverJoined) setOtherEverJoined(true);
  }, [remoteCount, otherEverJoined]);
  const otherLeft = otherEverJoined && remoteCount === 0;
  // From each side, the "other" participant is the opposite role.
  const otherLabel = role === 'interviewer' ? 'candidate' : 'interviewer';

  if (state === 'left') {
    const rejoin = () => {
      setState('connecting');
      join();
    };

    // Candidate: leaving the call must block the whole room — they should not be
    // able to keep editing code after stepping out. Cover everything with a
    // full-screen gate offering Rejoin or Leave (back to the home screen).
    if (role === 'candidate') {
      return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-ink/95 p-6 text-center backdrop-blur-sm">
          <div className="card max-w-sm p-8">
            <h2 className="text-xl font-bold text-white">You left the interview</h2>
            <p className="mt-2 text-sm text-muted">
              Rejoin to continue, or leave and return to the home screen.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button onClick={rejoin} className="btn-primary">
                Rejoin interview
              </button>
              <button onClick={() => router.push('/')} className="btn-ghost">
                Leave
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Interviewer: keep an inline rejoin so they still have their evaluation tools.
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-center">
        <p className="text-sm text-zinc-300">You left the video call.</p>
        <button
          onClick={rejoin}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Rejoin video
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state === 'connecting' && (
        <div className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-xs text-zinc-400">
          Connecting to video… allow camera &amp; microphone access if prompted.
        </div>
      )}

      {/* Candidate-only: run assistive look-away detection on the local camera. */}
      {role === 'candidate' && localId && <CandidateProctor participantId={localId} />}

      {/* Interviewer-only: record both speakers' audio for the post-hoc transcript.
          Skipped in the no-login demo (no database to store/transcribe to). */}
      {role === 'interviewer' && localId && recorderRef && !guest && (
        <InterviewAudioRecorder
          recorderRef={recorderRef}
          localId={localId}
          candidateId={orderedIds.find((id) => id !== localId) ?? null}
        />
      )}

      {/* Tiles: local first, then any remote participant. */}
      <div className="flex flex-col gap-2">
        {orderedIds.map((id) => {
          const isLocalTile = id === localId;
          return (
            <ParticipantTile
              key={id}
              participantId={id}
              onLocalWebcamTrack={isLocalTile ? onLocalWebcamTrack : undefined}
              // Interviewer's remote tile (the candidate) shows the look-away
              // signal. The candidate's own tile gets a subtle non-anxious hint.
              lookAway={role === 'interviewer' && !isLocalTile ? candidateProctoring : undefined}
              selfHint={role === 'candidate' && isLocalTile}
            />
          );
        })}
        {state === 'joined' && remoteCount === 0 && (
          <div
            className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-center text-xs font-medium ${
              otherLeft
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                : 'border-zinc-700 bg-zinc-900 text-zinc-400'
            }`}
          >
            {otherLeft ? (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                The {otherLabel} left the call.
              </>
            ) : (
              <>Waiting for the {otherLabel} to join the call…</>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 pt-1">
        {/* Mic toggle */}
        <button
          onClick={() => toggleMic()}
          title={localMicOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            localMicOn
              ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {localMicOn ? <IconMicOn /> : <IconMicOff />}
        </button>

        {/* Camera toggle */}
        <button
          onClick={() => toggleWebcam()}
          title={localWebcamOn ? 'Turn camera off' : 'Turn camera on'}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            localWebcamOn
              ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {localWebcamOn ? <IconCameraOn /> : <IconCameraOff />}
        </button>

        {/* Leave / hang up */}
        <button
          onClick={() => leave()}
          title="Leave the video call"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white transition-colors hover:bg-rose-500"
        >
          <IconHangUp />
        </button>
      </div>

      {/* Muted reminder — audio is only recorded/transcribed while unmuted. */}
      {state === 'joined' && !localMicOn && (
        <button
          onClick={() => toggleMic()}
          className="mx-auto flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/25"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          You’re muted — tap to unmute (needed to record)
        </button>
      )}
    </div>
  );
}
