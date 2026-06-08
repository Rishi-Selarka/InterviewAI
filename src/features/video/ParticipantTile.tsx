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

// Native fullscreen of a specific <video>. Works for BOTH the local and remote
// tiles (and iOS Safari) — unlike cloning the stream into a second <video>, which
// could fail to render a remote track already attached to the inline tile.
function enterFullscreen(el: HTMLVideoElement | null) {
  if (!el) return;
  const v = el as HTMLVideoElement & {
    webkitRequestFullscreen?: () => void;
    webkitEnterFullscreen?: () => void;
  };
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
  else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
}

interface Props {
  participantId: string;
  /** Called with the LOCAL participant's webcam track (or null) for proctoring. */
  onLocalWebcamTrack?: (track: MediaStreamTrack | null) => void;
  /**
   * Assistive look-away signal to display on this tile (interviewer viewing the
   * candidate). When present, the tile shows a calm border while looking away and
   * integrity badges.
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

  // Border reflects anomaly severity: red for serious (tab switch / extra face),
  // amber for soft signals (no face / looking away), normal otherwise.
  const severe = !!(lookAway && (lookAway.tabHidden || lookAway.multipleFaces));
  const warn = !!(lookAway && (lookAway.noFace || lookAway.lookingAway));
  const borderCls = severe
    ? 'border-rose-500 ring-2 ring-rose-500/40'
    : warn
      ? 'border-amber-500'
      : 'border-zinc-700';

  // Severity-ordered badges for the interviewer.
  const badges: { label: string; color: 'red' | 'amber' }[] = [];
  if (lookAway) {
    if (lookAway.tabHidden) badges.push({ label: 'Switched tab', color: 'red' });
    if (lookAway.multipleFaces) badges.push({ label: 'Multiple faces', color: 'red' });
    if (lookAway.noFace) badges.push({ label: 'No face', color: 'amber' });
    if (lookAway.lookingAway) badges.push({ label: 'Looking away', color: 'amber' });
  }

  const badgeClass = (color: 'red' | 'amber') =>
    color === 'red'
      ? 'rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white'
      : 'rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black';

  return (
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-lg border-2 bg-zinc-800 transition-colors ${borderCls}`}
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

        {/* Fullscreen button — top-right corner (only when there's a video). */}
        {webcamOn && (
          <button
            onClick={() => enterFullscreen(videoRef.current)}
            title="Fullscreen video"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded bg-black/60 text-zinc-300 transition-colors hover:bg-black/80 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M3 3h5v1.5H4.5V8H3V3zm9 0h5v5h-1.5V4.5H12V3zM3 12h1.5v3.5H8V17H3v-5zm12 3.5H11.5V17H17v-5h-1.5v3.5z" />
            </svg>
          </button>
        )}

        {/* Interviewer-only: integrity badges. */}
        {lookAway && (
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {badges.map((b) => (
              <span key={b.label} className={badgeClass(b.color)}>
                {b.label}
              </span>
            ))}
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200">
              Tab switches: {lookAway.tabSwitchCount} · Look-aways: {lookAway.lookAwayCount}
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
          <span className="shrink-0" title={micOn ? 'Mic on' : 'Mic off'}>
            {micOn ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 text-zinc-200"
              >
                <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4zm-2 6a5 5 0 0010 0h1.5a6.5 6.5 0 01-13 0H5zm5 8a1 1 0 01-1-1v-1.5a1 1 0 012 0V17a1 1 0 01-1 1z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3.5 w-3.5 text-rose-400"
              >
                <path d="M9.293 2.293a1 1 0 011.414 0l.3.3A3 3 0 0113 5.586V10a3 3 0 01-.17 1.006l1.665 1.665A4.978 4.978 0 0015 10h1.5a6.5 6.5 0 01-2.9 5.394l1.253 1.253a1 1 0 01-1.414 1.414L2.293 3.707a1 1 0 011.414-1.414l5.586 5.586V4a3 3 0 011-2.293zM5 10a4.978 4.978 0 00.766 2.67L4.512 11.416A6.44 6.44 0 013.5 10H5zm5 8a1 1 0 01-1-1v-1.5a1 1 0 012 0V17a1 1 0 01-1 1z" />
              </svg>
            )}
          </span>
        </div>

        {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      </div>
  );
}
