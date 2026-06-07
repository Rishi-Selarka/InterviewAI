'use client';

// Candidate-only assistive proctoring runner. It reads frames from the EXISTING
// local camera track (via useParticipant — no second getUserMedia), runs the
// MediaPipe FaceLandmarker a few times per second, debounces a "looking away"
// signal, and broadcasts four anomaly signals to the interviewer through
// Liveblocks presence:
//
//   lookingAway / lookAwayCount   — head-pose outside thresholds or no face
//   tabHidden  / tabSwitchCount   — candidate left the interview tab/window
//   multipleFaces                 — more than one face in frame
//   noFace                        — camera is on but no face detected
//
// This NEVER blocks or interrupts the candidate. It renders only a 1px offscreen
// <video> used as the detection source.

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useTabMonitor } from './useTabMonitor';
import { DEFAULT_PROCTORING } from '@/src/features/room/liveblocks.config';
import type { ProctoringState } from '@/src/features/room/liveblocks.config';

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

  // ---------------------------------------------------------------------------
  // Single source of truth: all proctoring state as refs so the detection loop
  // and event listeners can mutate them without triggering React re-renders.
  // ---------------------------------------------------------------------------

  // Head-pose / look-away
  const awaySinceRef = useRef<number | null>(null);
  const backSinceRef = useRef<number | null>(null);
  const lookingAwayRef = useRef<boolean>(DEFAULT_PROCTORING.lookingAway);
  const lookAwayCountRef = useRef<number>(DEFAULT_PROCTORING.lookAwayCount);
  const lastTsRef = useRef(0);

  // Tab/window monitoring (mutated by useTabMonitor via the callback below)
  const tabHiddenRef = useRef<boolean>(DEFAULT_PROCTORING.tabHidden);
  const tabSwitchCountRef = useRef<number>(DEFAULT_PROCTORING.tabSwitchCount);

  // Face-count signals
  const multipleFacesRef = useRef<boolean>(DEFAULT_PROCTORING.multipleFaces);
  const noFaceRef = useRef<boolean>(DEFAULT_PROCTORING.noFace);

  // ---------------------------------------------------------------------------
  // publish() — builds the full ProctoringState from refs and pushes it once.
  // Called on every meaningful change so the interviewer always sees up-to-date
  // values. Using useCallback so the function identity is stable for useEffect
  // deps (though all deps are refs, so the function never actually recreates).
  // ---------------------------------------------------------------------------
  const publish = useCallback(() => {
    const state: ProctoringState = {
      lookingAway: lookingAwayRef.current,
      lookAwayCount: lookAwayCountRef.current,
      tabHidden: tabHiddenRef.current,
      tabSwitchCount: tabSwitchCountRef.current,
      multipleFaces: multipleFacesRef.current,
      noFace: noFaceRef.current,
    };
    updateMyPresence({ proctoring: state });
  // updateMyPresence is stable from Liveblocks; list it to keep lint happy.
   
  }, [updateMyPresence]);

  // ---------------------------------------------------------------------------
  // 0. Publish a baseline immediately so the interviewer sees the channel is
  //    live even before the model loads or if the camera / model is unavailable.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    publish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // 1. Tab / window-switch detection via useTabMonitor.
  //    This works independently of MediaPipe — if the model never loads, tab
  //    switching is still detected and broadcast.
  // ---------------------------------------------------------------------------
  useTabMonitor(({ tabHidden, tabSwitchCount }) => {
    tabHiddenRef.current = tabHidden;
    tabSwitchCountRef.current = tabSwitchCount;
    publish();
  });

  // ---------------------------------------------------------------------------
  // 2. Load the FaceLandmarker once. Imported dynamically so the wasm/model code
  //    never ends up in the SSR/main bundle. numFaces: 2 so we can detect when a
  //    second person enters the frame.
  // ---------------------------------------------------------------------------
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
            numFaces: 2, // detect up to 2 faces so we can flag multiple-face events
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
        // Establish a defined baseline now that the model is live.
        publish();
      } catch {
        // Detection unavailable (offline, WebGL blocked, …). Tab-switch
        // detection above still works — the interview is never blocked by
        // proctoring failures.
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // 3. Attach the existing camera track to the offscreen detection video.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 4. Detection loop — throttled to DETECT_INTERVAL_MS. Pauses when the camera
  //    is off. On each tick:
  //
  //   a) Count faces in the result:
  //      • faceCount === 0  → noFace = true,  multipleFaces = false
  //      • faceCount === 1  → noFace = false, multipleFaces = false
  //      • faceCount  > 1   → noFace = false, multipleFaces = true
  //
  //   b) Head-pose on the FIRST face (same debounce logic as before).
  //
  //   c) Publish whenever any signal changes.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;

    if (!webcamOn) {
      // Camera off: clear away state but keep running counts.
      awaySinceRef.current = null;
      backSinceRef.current = null;
      const changed =
        lookingAwayRef.current ||
        multipleFacesRef.current ||
        noFaceRef.current;
      lookingAwayRef.current = false;
      multipleFacesRef.current = false;
      noFaceRef.current = false;
      if (changed) publish();
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

      let faceCount: number;
      let awayThisFrame: boolean;
      try {
        const result = landmarker.detectForVideo(video, ts);
        faceCount = result.faceLandmarks?.length ?? 0;

        // Head-pose check on the first detected face.
        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        const firstFaceDetected = faceCount > 0 && !!matrix;
        awayThisFrame = isAwayThisFrame({
          faceDetected: firstFaceDetected,
          angles: matrix ? anglesFromMatrix(matrix) : undefined,
          yawThresholdDeg: YAW_THRESHOLD_DEG,
          pitchThresholdDeg: PITCH_THRESHOLD_DEG,
        });
      } catch {
        return; // transient detection error — skip this frame
      }

      const now = ts;
      let didChange = false;

      // --- Multiple-face / no-face signals -----------------------------------
      const newMultiple = faceCount > 1;
      const newNoFace = faceCount === 0;
      if (newMultiple !== multipleFacesRef.current) {
        multipleFacesRef.current = newMultiple;
        didChange = true;
      }
      if (newNoFace !== noFaceRef.current) {
        noFaceRef.current = newNoFace;
        didChange = true;
      }

      // --- Head-pose look-away debounce state machine ------------------------
      // Away must persist AWAY_DEBOUNCE_MS before we latch lookingAway = true.
      // Not-away must persist BACK_DEBOUNCE_MS before we latch it back to false
      // (hysteresis to avoid flicker at the threshold boundary).
      if (awayThisFrame) {
        backSinceRef.current = null;
        if (awaySinceRef.current === null) awaySinceRef.current = now;
        if (!lookingAwayRef.current && now - awaySinceRef.current >= AWAY_DEBOUNCE_MS) {
          lookingAwayRef.current = true;
          lookAwayCountRef.current += 1;
          didChange = true;
        }
      } else {
        awaySinceRef.current = null;
        if (backSinceRef.current === null) backSinceRef.current = now;
        if (lookingAwayRef.current && now - backSinceRef.current >= BACK_DEBOUNCE_MS) {
          lookingAwayRef.current = false;
          didChange = true;
        }
      }

      if (didChange) publish();
    };

    const id = window.setInterval(tick, DETECT_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, webcamOn]);

  // Offscreen detection source only — nothing visible to the candidate.
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
