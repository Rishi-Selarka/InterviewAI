'use client';

// Candidate-only assistive proctoring runner. It reads frames from the EXISTING
// local camera track (via useParticipant — no second getUserMedia), runs the
// MediaPipe FaceLandmarker a few times per second, debounces a "looking away"
// signal, and broadcasts it to the interviewer through Liveblocks presence.
//
// This NEVER blocks or interrupts the candidate. It renders only a 1px offscreen
// <video> used as the detection source.

import { useEffect, useRef, useState } from 'react';
import { useParticipant } from '@videosdk.live/react-sdk';
import { useUpdateMyPresence } from '@liveblocks/react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  AWAY_DEBOUNCE_MS,
  BACK_DEBOUNCE_MS,
  DETECT_INTERVAL_MS,
  FACE_LANDMARKER_MODEL_URL,
  MEDIAPIPE_WASM_URL,
  PITCH_THRESHOLD_DEG,
  YAW_THRESHOLD_DEG,
} from './config';
import { anglesFromMatrix, isAwayThisFrame } from './headPose';

interface Props {
  /** The LOCAL participant's id (the candidate viewing their own camera). */
  participantId: string;
}

export default function CandidateProctor({ participantId }: Props) {
  const { webcamStream, webcamOn } = useParticipant(participantId);
  const updateMyPresence = useUpdateMyPresence();

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const [ready, setReady] = useState(false);

  // Debounce state (mutable, updated inside the detection loop — not per render).
  const awaySinceRef = useRef<number | null>(null);
  const backSinceRef = useRef<number | null>(null);
  const lookingAwayRef = useRef(false);
  const countRef = useRef(0);
  const lastTsRef = useRef(0);

  // Push the current proctoring state to the interviewer via presence.
  const publish = () => {
    updateMyPresence({
      proctoring: { lookingAway: lookingAwayRef.current, lookAwayCount: countRef.current },
    });
  };

  // 0. Publish a baseline immediately so the interviewer sees the assistive
  //    signal is active (and the channel exists) even before the model loads or
  //    if detection is unavailable.
  useEffect(() => {
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Load the FaceLandmarker once. Imported dynamically so the wasm/model code
  //    never ends up in the SSR/main bundle.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const create = (delegate: 'GPU' | 'CPU') =>
          vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
          });
        // Prefer GPU; fall back to CPU where WebGL is unavailable.
        const landmarker = await create('GPU').catch(() => create('CPU'));
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
        // Establish a defined baseline so the interviewer sees a value.
        publish();
      } catch {
        // Detection unavailable (offline, WebGL blocked, …). Stay silent and
        // non-punitive — the interview is never blocked by proctoring.
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Attach the existing camera track to the offscreen detection video.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (webcamOn && webcamStream?.track) {
      const stream = new MediaStream();
      stream.addTrack(webcamStream.track);
      el.srcObject = stream;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [webcamStream, webcamOn]);

  // 3. Detection loop — throttled to DETECT_INTERVAL_MS. Pauses when the camera
  //    is off (we report not-looking-away rather than erroring).
  useEffect(() => {
    if (!ready) return;

    if (!webcamOn) {
      // Camera off: clear the away state but keep the running count.
      awaySinceRef.current = null;
      backSinceRef.current = null;
      if (lookingAwayRef.current) {
        lookingAwayRef.current = false;
        publish();
      }
      return;
    }

    const tick = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.videoWidth === 0) return;

      // detectForVideo requires strictly increasing timestamps.
      let ts = performance.now();
      if (ts <= lastTsRef.current) ts = lastTsRef.current + 1;
      lastTsRef.current = ts;

      let awayThisFrame: boolean;
      try {
        const result = landmarker.detectForVideo(video, ts);
        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        const faceDetected = (result.faceLandmarks?.length ?? 0) > 0 && !!matrix;
        awayThisFrame = isAwayThisFrame({
          faceDetected,
          angles: matrix ? anglesFromMatrix(matrix) : undefined,
          yawThresholdDeg: YAW_THRESHOLD_DEG,
          pitchThresholdDeg: PITCH_THRESHOLD_DEG,
        });
      } catch {
        return; // transient detection error — skip this frame
      }

      const now = ts;

      // Debounced state machine: away must persist AWAY_DEBOUNCE_MS to latch on;
      // not-away must persist BACK_DEBOUNCE_MS to latch off (hysteresis).
      if (awayThisFrame) {
        backSinceRef.current = null;
        if (awaySinceRef.current === null) awaySinceRef.current = now;
        if (!lookingAwayRef.current && now - awaySinceRef.current >= AWAY_DEBOUNCE_MS) {
          lookingAwayRef.current = true;
          countRef.current += 1; // a new look-away event
          publish();
        }
      } else {
        awaySinceRef.current = null;
        if (backSinceRef.current === null) backSinceRef.current = now;
        if (lookingAwayRef.current && now - backSinceRef.current >= BACK_DEBOUNCE_MS) {
          lookingAwayRef.current = false;
          publish();
        }
      }
    };

    const id = window.setInterval(tick, DETECT_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, webcamOn]);

  // Offscreen detection source only — nothing visible.
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      aria-hidden
      className="pointer-events-none absolute h-px w-px opacity-0"
    />
  );
}
