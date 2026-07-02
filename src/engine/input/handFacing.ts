// Classifies whether a detected hand is facing the camera, and if not, how
// it deviates — so the UI can tell the user what to correct.
//
// IMPORTANT: feed this MediaPipe *world* landmarks (metric 3D, meters), not
// the normalized ones. Normalized landmarks scale x by frame width, y by
// frame height, and z only "roughly" by width, so 3D angles computed from
// them are distorted. World landmarks are isotropic, so for a segment
// between two landmarks, asin(|dz| / 3D length) is its true angle out of
// the camera plane.
//
// - "turned": the knuckle line (index MCP 5 → pinky MCP 17) leaves the camera
//   plane — the hand is rotated sideways like a karate chop.
// - "pitched": the palm line (wrist 0 → middle MCP 9) leaves the camera
//   plane — the fingers point toward or away from the camera.

export type HandFacing = 'ok' | 'turned' | 'pitched';

type Landmark = { x: number; y: number; z: number };

// Strict-ish thresholds: nudge as soon as the hand meaningfully leaves the
// camera plane. Pitch gets a little extra slack because relaxed hands
// naturally lean back.
export const TURN_THRESHOLD_DEG = 25;
export const PITCH_THRESHOLD_DEG = 30;

function outOfPlaneDeg(a: Landmark, b: Landmark): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return 0; // degenerate — can't judge, assume fine
  return (Math.asin(Math.min(1, Math.abs(dz) / len)) * 180) / Math.PI;
}

// Raw angles, exposed for debugging/tuning (set localStorage
// 'froola.debugFacing' = '1' to log them from the camera loop).
export function handFacingAngles(lm: Landmark[]): { turn: number; pitch: number } {
  return {
    turn: outOfPlaneDeg(lm[5], lm[17]),
    pitch: outOfPlaneDeg(lm[0], lm[9]),
  };
}

export function classifyHandFacing(lm: Landmark[]): HandFacing {
  const { turn, pitch } = handFacingAngles(lm);
  const turnExcess = turn - TURN_THRESHOLD_DEG;
  const pitchExcess = pitch - PITCH_THRESHOLD_DEG;
  if (turnExcess < 0 && pitchExcess < 0) return 'ok';
  return turnExcess >= pitchExcess ? 'turned' : 'pitched';
}
