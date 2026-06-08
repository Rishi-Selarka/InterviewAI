'use client';

// Video panel: fetches a server-minted VideoSDK token + the stable meeting id for
// this room, then mounts the meeting. Auto-joins on entry. This module is loaded
// client-side only (the VideoSDK SDK touches `self` at import time) — see the
// dynamic() import in RoomLayout.

import { useEffect, useState } from 'react';
import { MeetingProvider, createMicrophoneAudioTrack } from '@videosdk.live/react-sdk';
import MeetingView from './MeetingView';
import type { Role } from '@/src/features/room/liveblocks.config';
import type { RecorderApi } from '@/src/features/recording/recorderApi';

interface Props {
  roomId: string;
  /** Viewer's role — drives candidate-side proctoring vs interviewer-side display. */
  role: Role;
  /** Display name shown to the other participant. */
  name: string;
  /** Forwarded for upcoming proctoring — exposes the local camera track. */
  onLocalWebcamTrack?: (track: MediaStreamTrack | null) => void;
  /** Interviewer-only: populated with the dual-stream audio recorder controls. */
  recorderRef?: React.RefObject<RecorderApi | null>;
  /** No-login demo mode: skip audio recording (no DB to store/transcribe to). */
  guest?: boolean;
}

type Fetched =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; token: string; meetingId: string; micTrack: MediaStream | null };

// Build a noise-suppressed mic track so the fan/background noise doesn't get
// broadcast or recorded. Best-effort: if it fails (permission/unsupported), we
// fall back to VideoSDK's default mic (which still applies browser-default NS).
async function createSuppressedMicTrack(): Promise<MediaStream | null> {
  try {
    return await createMicrophoneAudioTrack({
      noiseConfig: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      encoderConfig: 'speech_standard',
    });
  } catch {
    return null;
  }
}

export default function VideoPanel({ roomId, role, name, onLocalWebcamTrack, recorderRef, guest }: Props) {
  const [state, setState] = useState<Fetched>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Fetch the token and prepare the noise-suppressed mic track in parallel.
        const [res, micTrack] = await Promise.all([
          fetch(`/api/videosdk-token?roomId=${encodeURIComponent(roomId)}`),
          createSuppressedMicTrack(),
        ]);
        const data = await res.json();
        if (cancelled) {
          micTrack?.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!res.ok || !data.token || !data.meetingId) {
          micTrack?.getTracks().forEach((t) => t.stop());
          setState({ status: 'error', message: data.error || 'Could not start video.' });
          return;
        }
        setState({ status: 'ready', token: data.token, meetingId: data.meetingId, micTrack });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-4 text-center text-xs text-zinc-400">
        Setting up video…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-4 text-center text-xs text-rose-300">
        Video unavailable: {state.message}
      </div>
    );
  }

  return (
    <MeetingProvider
      token={state.token}
      // Auto-join when the panel mounts (prompts for camera/mic permission). The
      // SDK joins exactly once because React Strict Mode is disabled (see
      // next.config.ts) — letting the SDK own join timing is more reliable than a
      // manual join() effect, which can fire before the meeting is ready.
      joinWithoutUserInteraction
      config={{
        meetingId: state.meetingId,
        name,
        // Join UNMUTED so the interview auto-records/transcribes. Fan/background
        // noise is filtered by the noise-suppressed custom mic track below.
        micEnabled: true,
        webcamEnabled: true,
        customMicrophoneAudioTrack: state.micTrack ?? undefined,
        debugMode: false,
      }}
    >
      <MeetingView role={role} onLocalWebcamTrack={onLocalWebcamTrack} recorderRef={recorderRef} guest={guest} />
    </MeetingProvider>
  );
}
