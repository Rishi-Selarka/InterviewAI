'use client';

// Interviewer-only. Records TWO separate continuous audio streams — the
// interviewer's own mic and the candidate's mic — from the EXISTING VideoSDK
// tracks (no re-acquire). Two files = speaker labels with no diarization.
//
// It exposes a stop()/isRecording() API via `recorderRef` so the End-interview
// flow can collect the blobs. Late join / mute / rejoin are handled by the
// per-speaker AudioRoleRecorder (it keeps one continuous file with silence).

import { useEffect, useState } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import { AudioRoleRecorder } from './audioRecorder';
import type { RecorderApi } from './recorderApi';

interface Props {
  recorderRef: React.RefObject<RecorderApi | null>;
  localId: string;
  candidateId: string | null;
}

// Feeds one participant's current mic track into a recorder, reacting to
// mute/unmute and track replacement.
function MicFeeder({
  participantId,
  recorder,
}: {
  participantId: string;
  recorder: AudioRoleRecorder;
}) {
  const { micStream, micOn } = useParticipant(participantId);
  useEffect(() => {
    recorder.setTrack(micOn && micStream?.track ? micStream.track : null);
  }, [micStream, micOn, recorder]);
  useEffect(() => {
    // On unmount (e.g. candidate leaves), disconnect — recording continues silent.
    return () => recorder.setTrack(null);
  }, [recorder]);
  return null;
}

export default function InterviewAudioRecorder({ recorderRef, localId, candidateId }: Props) {
  // Recording begins on mount, so start "true"; stop() flips it off.
  const [recording, setRecording] = useState(true);

  // One recorder per role, created once (lazy useState init is render-safe).
  const [recorders] = useState(() => ({
    interviewer: new AudioRoleRecorder(),
    candidate: new AudioRoleRecorder(),
  }));

  useEffect(() => {
    recorders.interviewer.start();
    recorders.candidate.start();

    recorderRef.current = {
      isRecording: () => recorders.interviewer.started || recorders.candidate.started,
      stop: async () => {
        const [interviewer, candidate] = await Promise.all([
          recorders.interviewer.stop(),
          recorders.candidate.stop(),
        ]);
        setRecording(false);
        return { interviewer, candidate };
      },
    };

    return () => {
      // Best-effort stop if the component unmounts without an explicit end.
      recorders.interviewer.stop().catch(() => {});
      recorders.candidate.stop().catch(() => {});
      recorderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <MicFeeder participantId={localId} recorder={recorders.interviewer} />
      {candidateId && <MicFeeder participantId={candidateId} recorder={recorders.candidate} />}
      {recording && (
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          Recording audio for the transcript
        </div>
      )}
    </>
  );
}
