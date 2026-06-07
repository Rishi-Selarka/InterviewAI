'use client';

// The live meeting UI rendered INSIDE our room's video panel. Custom layout:
// stacked participant tiles + a compact control bar. Auto-joins on mount (via the
// MeetingProvider) and tracks join/leave so we can show "Connecting…" and a
// rejoin affordance.

import { useState } from 'react';
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
}

export default function MeetingView({ role, onLocalWebcamTrack, recorderRef }: Props) {
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

  if (state === 'left') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-center">
        <p className="text-sm text-zinc-300">You left the video call.</p>
        <button
          onClick={() => {
            setState('connecting');
            join();
          }}
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

      {/* Interviewer-only: record both speakers' audio for the post-hoc transcript. */}
      {role === 'interviewer' && localId && recorderRef && (
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
          <p className="px-1 text-center text-xs text-zinc-500">
            Waiting for the other participant to join the call…
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <button
          onClick={() => toggleMic()}
          title={localMicOn ? 'Mute microphone' : 'Unmute microphone'}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
            localMicOn
              ? 'bg-zinc-700 text-white hover:bg-zinc-600'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {localMicOn ? '🎙️' : '🔇'}
        </button>
        <button
          onClick={() => toggleWebcam()}
          title={localWebcamOn ? 'Turn camera off' : 'Turn camera on'}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
            localWebcamOn
              ? 'bg-zinc-700 text-white hover:bg-zinc-600'
              : 'bg-rose-600 text-white hover:bg-rose-500'
          }`}
        >
          {localWebcamOn ? '📹' : '🚫'}
        </button>
        <button
          onClick={() => leave()}
          title="Leave the video call"
          className="flex h-9 items-center justify-center rounded-full bg-rose-600 px-4 text-xs font-medium text-white transition-colors hover:bg-rose-500"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
