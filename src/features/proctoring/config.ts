// Tunable constants for assistive look-away proctoring. All thresholds live here
// so they're easy to adjust without touching detection logic.

// MediaPipe assets. The wasm version is pinned to the installed
// @mediapipe/tasks-vision version to avoid an ABI mismatch with @latest.
export const MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
export const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// How often we run detection. We deliberately do NOT run every animation frame —
// a few frames per second is plenty for head-pose and far cheaper.
export const DETECT_INTERVAL_MS = 200; // ~5 fps

// A glance only counts as "looking away" once the away state has persisted for
// this long, so brief natural glances don't trigger it.
export const AWAY_DEBOUNCE_MS = 1500;

// After returning to looking-away from a clear "looking at screen" period, the
// away state must be stable this long before we flip back (hysteresis to avoid
// flicker right at the threshold).
export const BACK_DEBOUNCE_MS = 600;

// Head-pose thresholds (degrees from facing the camera). Beyond these, the
// candidate is considered to be looking away.
export const YAW_THRESHOLD_DEG = 22; // turning left/right
export const PITCH_THRESHOLD_DEG = 18; // looking up/down (e.g. down at a phone)
