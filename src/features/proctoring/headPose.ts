// Pure head-pose math (no React, no MediaPipe imports) so it's easy to reason
// about and unit-test.
//
// MediaPipe's FaceLandmarker, with outputFacialTransformationMatrixes:true,
// returns a 4x4 matrix that maps the canonical face model into camera space. The
// matrix data is a flat 16-element array in COLUMN-MAJOR order (OpenGL style), so
// the columns are the face's local axes expressed in camera coordinates:
//
//   col0 = right   (m0,m1,m2)
//   col1 = up      (m4,m5,m6)
//   col2 = forward (m8,m9,m10)   <- the direction the face points
//
// When the candidate faces the camera, the forward axis is ~parallel to the
// camera's view axis (z), so both yaw and pitch are ~0. As they turn their head,
// the forward axis tilts and yaw/pitch grow. Using |forwardZ| in the denominators
// makes the result independent of whether forward points toward (-z) or away
// (+z) from the camera, which keeps it robust to sign conventions.

export interface HeadAngles {
  /** Left/right rotation magnitude in degrees (always >= 0). */
  yaw: number;
  /** Up/down rotation magnitude in degrees (always >= 0). */
  pitch: number;
}

const RAD2DEG = 180 / Math.PI;

/**
 * Extract yaw/pitch magnitudes from a MediaPipe facial transformation matrix.
 * `data` must be the 16-element column-major matrix array.
 */
export function anglesFromMatrix(data: number[] | Float32Array): HeadAngles {
  // Forward axis = third column.
  const fx = data[8];
  const fy = data[9];
  const fz = data[10];

  const norm = Math.hypot(fx, fy, fz) || 1;
  const nx = fx / norm;
  const ny = fy / norm;
  const nz = fz / norm;

  // |nz| in the denominator => symmetric for forward pointing toward or away.
  const absZ = Math.abs(nz) || 1e-6;
  const yaw = Math.abs(Math.atan2(nx, absZ)) * RAD2DEG;
  const pitch = Math.abs(Math.atan2(ny, absZ)) * RAD2DEG;

  return { yaw, pitch };
}

export interface LookAwayInputs {
  /** Whether a face was detected at all this frame. */
  faceDetected: boolean;
  /** Head angles, if a face was detected. */
  angles?: HeadAngles;
  yawThresholdDeg: number;
  pitchThresholdDeg: number;
}

/**
 * Decide whether THIS frame looks like "looking away" (instantaneous, before
 * debouncing). No face at all (looked down, left the frame, fully turned) counts
 * as away, as does a head turned beyond the yaw/pitch thresholds.
 */
export function isAwayThisFrame({
  faceDetected,
  angles,
  yawThresholdDeg,
  pitchThresholdDeg,
}: LookAwayInputs): boolean {
  if (!faceDetected || !angles) return true;
  return angles.yaw > yawThresholdDeg || angles.pitch > pitchThresholdDeg;
}
