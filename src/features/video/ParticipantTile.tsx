'use client';

// One participant's video tile, built from the raw media tracks (custom UI — we
// do NOT use a prebuilt player). We construct a MediaStream from the SDK's
// webcam/mic tracks ourselves and attach it to plain <video>/<audio> elements.
//
// Because we hold the local webcam track directly here, frames stay fully
// readable for the upcoming MediaPipe look-away proctoring (see onLocalWebcamTrack).

import { useEffect, useRef } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import type { ProctoringState } from '@/src/features/room/liveblocks.config';

interface Props {
  participantId: string;
  /** Called with the LOCAL participant's webcam track (or null) for proctoring. */
  onLocalWebcamTrack?: (track: MediaStreamTrack | null) => void;
  /**
   * Assistive look-away signal to display on this tile (interviewer viewing the
   * candidate). When present, the tile shows a calm border while looking away and
   * a neutral "Looked away: N times" indicator.
   */
  lookAway?: ProctoringState;
  /** Subtle, non-anxious "assistive check active" hint on the candidate's own tile. */
  selfHint?: boolean;
}

export default function ParticipantTile({
  participantId,
  onLocalWebcamTrack,
  lookAway,
  selfHint,
}: Props) {
  const { webcamStream, micStream, webcamOn, micOn, displayName, isLocal } =
    useParticipant(participantId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach (or detach) the webcam video.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (webcamOn && webcamStream?.track) {
      const stream = new MediaStream();
      stream.addTrack(webcamStream.track);
      el.srcObject = stream;
      el.play().catch(() => {});
      // Hand the local camera track to whoever wants it (proctoring later).
      if (isLocal) onLocalWebcamTrack?.(webcamStream.track);
    } else {
      el.srcObject = null;
      if (isLocal) onLocalWebcamTrack?.(null);
    }
  }, [webcamStream, webcamOn, isLocal, onLocalWebcamTrack]);

  // Play remote audio. The local mic is never played back (that would echo).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal) return;

    if (micOn && micStream?.track) {
      const stream = new MediaStream();
      stream.addTrack(micStream.track);
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [micStream, micOn, isLocal]);

  const awayActive = !!lookAway?.lookingAway;

  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-lg border-2 bg-zinc-800 transition-colors ${
        awayActive ? 'border-amber-500' : 'border-zinc-700'
      }`}
    >
      {webcamOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          // Mirror the local self-view, like every other video app.
          className={`h-full w-full object-cover ${isLocal ? '-scale-x-100' : ''}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-lg font-semibold text-zinc-200">
            {(displayName || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Interviewer-only: neutral look-away indicator for the candidate tile. */}
      {lookAway && (
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {awayActive && (
            <span className="rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
              Looked away
            </span>
          )}
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
            Looked away: {lookAway.lookAwayCount}{' '}
            {lookAway.lookAwayCount === 1 ? 'time' : 'times'}
          </span>
        </div>
      )}

      {/* Candidate-only: subtle, non-anxious hint that an assistive check is on. */}
      {selfHint && (
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
          Attention check active
        </span>
      )}

      {/* Name + status overlay */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="truncate text-xs font-medium text-white">
          {displayName || 'Participant'}
          {isLocal && ' (you)'}
        </span>
        <span className="shrink-0 text-xs" title={micOn ? 'Mic on' : 'Mic off'}>
          {micOn ? '🎙️' : '🔇'}
        </span>
      </div>

      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
    </div>
  );
}
