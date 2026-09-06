// Continuous finger curl, replacing a boolean "is this a fist" test.
//
// The previous check counted how many fingers had their tip closer to the
// wrist than their knuckle by a fixed ratio, and called it a fist at three of
// four. That is a hard edge: a hand held right at the boundary flips the
// answer frame to frame, and because a fist locks the current chord, the
// flipping was audible — the lock engaging and releasing while the hand sat
// still.
//
// Scoring curl continuously lets the gate above it apply hysteresis, which is
// what actually fixes the chatter. The score is also worth reporting on its
// own: a consumer can fade an effect in over the curl rather than waiting for
// a binary to flip.

import type { Landmark } from './types';

/** Fingertip landmarks: index, middle, ring, pinky. */
const TIPS = [8, 12, 16, 20] as const;
/** Matching knuckle (MCP) landmarks for the same four fingers. */
const MCPS = [5, 9, 13, 17] as const;
const WRIST = 0;

// Ratio of |tip - wrist| to |knuckle - wrist|. An extended finger puts its tip
// far beyond the knuckle (ratio well above 1); a curled one folds the tip back
// toward the palm, at or below the knuckle's own distance.
//
// The old boolean threshold sat at 0.95. These bounds bracket it deliberately,
// so the midpoint of the ramp lands near the behaviour that was already tuned
// against a real camera, and only the sharpness of the edge changes.
const FULLY_CURLED_RATIO = 0.85;
const FULLY_OPEN_RATIO = 1.45;

function dist3(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Smoothstep, used to round off both ends of the curl ramp. */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Curl of one finger: 0 fully extended, 1 fully folded.
 * @param tipIdx fingertip landmark index
 * @param mcpIdx knuckle landmark index for the same finger
 */
export function fingerCurl(lm: Landmark[], tipIdx: number, mcpIdx: number): number {
  const wrist = lm[WRIST];
  const knuckleSpan = dist3(lm[mcpIdx], wrist);
  // A degenerate knuckle span means the landmarks are collapsed or missing;
  // there is nothing to measure against, so report "not curled" rather than
  // dividing by ~0 and producing a spurious fist.
  if (knuckleSpan < 1e-6) return 0;
  const ratio = dist3(lm[tipIdx], wrist) / knuckleSpan;
  return smoothstep((FULLY_OPEN_RATIO - ratio) / (FULLY_OPEN_RATIO - FULLY_CURLED_RATIO));
}

/**
 * Overall curl of a hand: 0 is a flat open hand, 1 a tight fist.
 *
 * The thumb is excluded on purpose. It folds across the palm rather than
 * toward the wrist, so the same tip-versus-knuckle geometry does not describe
 * it, and including it mostly added noise to the score.
 */
export function curlScore(lm: Landmark[]): number {
  if (!lm || lm.length <= TIPS[TIPS.length - 1]) return 0;
  let total = 0;
  for (let i = 0; i < TIPS.length; i++) total += fingerCurl(lm, TIPS[i], MCPS[i]);
  return total / TIPS.length;
}
