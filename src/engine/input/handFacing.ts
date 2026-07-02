// Classifies whether a detected hand is facing the camera, and if not, how
// it deviates — so the UI can tell the user what to correct.
//
// MediaPipe hand landmarks are normalized with z roughly on the same scale as
// x/y (more negative = closer to camera). For a segment between two landmarks,
// asin(|dz| / 3D length) is the segment's angle out of the camera plane,
// independent of hand size or distance.
//
// - "turned": the knuckle line (index MCP 5 → pinky MCP 17) leaves the camera
//   plane — the hand is rotated sideways like a karate chop.
// - "pitched": the palm line (wrist 0 → middle MCP 9) leaves the camera
//   plane — the fingers point toward or away from the camera.

export type HandFacing = 'ok' | 'turned' | 'pitched';

type Landmark = { x: number; y: number; z: number };

// Generous thresholds: the popup is a nudge for hands that have drifted well
// off-plane, not a precision meter. Pitch gets extra slack because relaxed
// hands naturally lean back a little.
export const TURN_THRESHOLD_DEG = 35;
export const PITCH_THRESHOLD_DEG = 45;

function outOfPlaneDeg(a: Landmark, b: Landmark): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return 0; // degenerate — can't judge, assume fine
  return (Math.asin(Math.min(1, Math.abs(dz) / len)) * 180) / Math.PI;
}

export function classifyHandFacing(lm: Landmark[]): HandFacing {
  const turn = outOfPlaneDeg(lm[5], lm[17]);
  const pitch = outOfPlaneDeg(lm[0], lm[9]);
  const turnExcess = turn - TURN_THRESHOLD_DEG;
  const pitchExcess = pitch - PITCH_THRESHOLD_DEG;
  if (turnExcess < 0 && pitchExcess < 0) return 'ok';
  return turnExcess >= pitchExcess ? 'turned' : 'pitched';
}
