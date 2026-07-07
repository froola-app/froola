// Head-gesture detection (nod on pitch, shake on yaw) from the angles
// extracted from MediaPipe's facial transformation matrix. Pure module:
// no React, no MediaPipe, no DOM.

/**
 * Pitch in degrees from a 16-element column-major 4x4 head-pose matrix.
 * R[row][col] = data[col*4 + row]; pitch = atan2(R[2][1], R[2][2]).
 * Contract: a pure rotation about the x-axis by θ returns θ. Under a
 * compound yaw-then-pitch rotation (Ry·Rx) both atan2 terms carry the same
 * cos(yaw) factor, which cancels — pitch is recovered exactly.
 */
export function pitchFromMatrix(data: ArrayLike<number>): number {
  return Math.atan2(data[6], data[10]) * (180 / Math.PI);
}

/**
 * Yaw in degrees from the same matrix: atan2(-R[2][0], √(R[2][1]²+R[2][2]²)).
 * Contract: a pure rotation about the y-axis by θ returns θ, and yaw is
 * recovered exactly under a compound Ry·Rx rotation. The hypot denominator
 * (rather than R[2][2] alone) keeps the reading pitch-independent.
 */
export function yawFromMatrix(data: ArrayLike<number>): number {
  return Math.atan2(-data[2], Math.hypot(data[6], data[10])) * (180 / Math.PI);
}

export const BASELINE_ALPHA = 0.02;      // baseline EMA weight (~2s time constant at 30Hz)
export const BASELINE_SLOW_ALPHA = 0.002; // baseline EMA weight outside the band (BASELINE_ALPHA / 10)
export const BASELINE_BAND_DEG = 5;      // baseline only adapts inside this band
export const DEFLECT_THRESHOLD_DEG = 8;  // deviation that engages a tilt-hold
export const RELEASE_THRESHOLD_DEG = 5;  // deviation below this releases the hold (hysteresis)
export const HOLD_ENGAGE_MS = 150;       // deflection must persist this long before the first step (rejects twitches)
export const REPEAT_MS = 400;            // step repeat interval while the tilt is held
export const MAX_HOLD_MS = 4000;         // deflected this long = posture change, not volume intent
export const REFRACTORY_MS = 500;        // after a release, ignore new deflections (return overshoot can't fire the opposite step)

export type TiltEvent = 'up' | 'down';

export interface TiltHoldDetector {
  sample(pitchDeg: number, nowMs: number): TiltEvent | null;
  /** Mutual suppression: abort any in-flight hold and hold off for the refractory period. */
  suppress(nowMs: number): void;
  reset(): void;
}

/**
 * Tilt-and-hold: deflect past DEFLECT_THRESHOLD_DEG and keep it there — one
 * step fires once the hold has lasted HOLD_ENGAGE_MS, then repeats every
 * REPEAT_MS until the head comes back inside RELEASE_THRESHOLD_DEG. Releasing
 * enters a refractory window so the return (including overshoot past neutral)
 * can never fire the opposite direction. A hold past MAX_HOLD_MS is a posture
 * change: it re-baselines silently and remembers the old neutral, so the
 * eventual return to that neutral is swallowed instead of read as a new tilt.
 */
export function createTiltHoldDetector(debugLog?: (msg: string) => void): TiltHoldDetector {
  let seeded = false;
  let baseline = 0;
  let state: 'IDLE' | 'HOLDING' = 'IDLE';
  let direction: TiltEvent = 'down';
  let startMs = 0;
  let lastFireMs = -Infinity;
  let fired = false;
  let refractoryUntil = -Infinity;
  // Neutral pitch before a MAX_HOLD_MS posture re-baseline; a later "tilt"
  // that lands back at this value is the head returning home, not a gesture.
  let prevNeutral: number | null = null;

  return {
    reset() {
      seeded = false;
      state = 'IDLE';
      refractoryUntil = -Infinity;
      prevNeutral = null;
    },
    suppress(nowMs) {
      state = 'IDLE';
      refractoryUntil = nowMs + REFRACTORY_MS;
    },
    sample(pitchDeg, nowMs) {
      if (!Number.isFinite(pitchDeg)) return null;
      if (!seeded) {
        seeded = true;
        baseline = pitchDeg;
        return null;
      }
      const dev = pitchDeg - baseline;

      if (state === 'IDLE') {
        if (Math.abs(dev) <= BASELINE_BAND_DEG) {
          baseline += BASELINE_ALPHA * dev;
        } else if (Math.abs(dev) > DEFLECT_THRESHOLD_DEG && nowMs >= refractoryUntil) {
          state = 'HOLDING';
          direction = dev > 0 ? 'down' : 'up';
          startMs = nowMs;
          lastFireMs = -Infinity;
          fired = false;
          debugLog?.(`engage ${direction} dev=${dev.toFixed(1)} baseline=${baseline.toFixed(1)}`);
        } else {
          // Outside the band but not engaging (either mid-band-to-threshold,
          // or blocked by the refractory period): adapt slowly so a settled
          // posture eventually re-centers instead of freezing the baseline
          // forever, without polluting it during a real tilt's rising edge.
          baseline += BASELINE_SLOW_ALPHA * dev;
        }
        return null;
      }

      // HOLDING
      const elapsed = nowMs - startMs;
      const released =
        Math.abs(dev) < RELEASE_THRESHOLD_DEG ||
        (direction === 'down' ? dev < 0 : dev > 0); // shot through neutral
      if (released) {
        state = 'IDLE';
        // Only a hold that actually stepped needs the refractory (its return
        // may overshoot); a silent twitch can re-engage immediately.
        if (fired) refractoryUntil = nowMs + REFRACTORY_MS;
        debugLog?.(`release after ${elapsed}ms`);
        return null;
      }
      if (elapsed > MAX_HOLD_MS) {
        // Posture change (e.g. looking down at hands), not volume intent.
        prevNeutral = baseline;
        baseline = pitchDeg;
        state = 'IDLE';
        refractoryUntil = nowMs + REFRACTORY_MS;
        debugLog?.(`re-baseline to ${baseline.toFixed(1)} after ${elapsed}ms`);
        return null;
      }
      if (elapsed >= HOLD_ENGAGE_MS && nowMs - lastFireMs >= REPEAT_MS) {
        if (prevNeutral !== null && Math.abs(pitchDeg - prevNeutral) <= BASELINE_BAND_DEG) {
          // Head returning to its pre-posture-change neutral: swallow it.
          baseline = prevNeutral;
          prevNeutral = null;
          state = 'IDLE';
          refractoryUntil = nowMs + REFRACTORY_MS;
          debugLog?.(`return to neutral ${baseline.toFixed(1)} — swallowed`);
          return null;
        }
        prevNeutral = null;
        lastFireMs = nowMs;
        fired = true;
        debugLog?.(`fire ${direction} at ${elapsed}ms`);
        return direction;
      }
      return null;
    },
  };
}

export const SHAKE_THRESHOLD_DEG = 8;   // yaw deviation each side must cross
export const SHAKE_WINDOW_MS = 700;     // both sides must be crossed within this
export const SHAKE_REFRACTORY_MS = 700; // one fire per shake — a sustained shake doesn't machine-gun

export interface ShakeDetector {
  /** Returns true when a shake fires on this sample. */
  sample(yawDeg: number, nowMs: number): boolean;
  /** Mutual suppression: abort any in-flight swing and hold off for the refractory period. */
  suppress(nowMs: number): void;
  reset(): void;
}

/**
 * Head-shake = a two-sided yaw swing: past SHAKE_THRESHOLD_DEG on one side
 * AND then past it on the other, both within SHAKE_WINDOW_MS. One-sided
 * motion (glancing at a hand, turning to look at something) never fires no
 * matter how large. Fires on the second-side crossing — a shake is
 * unambiguous at that point, and waiting for a return would read as lag.
 * Baseline handling mirrors the nod detector: fast EMA in the ±5° band,
 * slow outside it, silent re-baseline when the window expires still
 * deflected (a sustained side-look is a posture change, not a gesture).
 */
export function createShakeDetector(debugLog?: (msg: string) => void): ShakeDetector {
  let seeded = false;
  let baseline = 0;
  let state: 'IDLE' | 'SWING' = 'IDLE';
  let firstSide: 1 | -1 = 1;
  let startMs = 0;
  let refractoryUntil = -Infinity;

  return {
    reset() {
      seeded = false;
      state = 'IDLE';
      refractoryUntil = -Infinity;
    },
    suppress(nowMs) {
      state = 'IDLE';
      refractoryUntil = nowMs + SHAKE_REFRACTORY_MS;
    },
    sample(yawDeg, nowMs) {
      if (!Number.isFinite(yawDeg)) return false;
      if (!seeded) {
        seeded = true;
        baseline = yawDeg;
        return false;
      }
      const dev = yawDeg - baseline;

      if (state === 'IDLE') {
        if (Math.abs(dev) <= BASELINE_BAND_DEG) {
          baseline += BASELINE_ALPHA * dev;
        } else if (Math.abs(dev) > SHAKE_THRESHOLD_DEG && nowMs >= refractoryUntil) {
          state = 'SWING';
          firstSide = dev > 0 ? 1 : -1;
          startMs = nowMs;
          debugLog?.(`swing ${firstSide > 0 ? 'right' : 'left'} dev=${dev.toFixed(1)} baseline=${baseline.toFixed(1)}`);
        } else {
          baseline += BASELINE_SLOW_ALPHA * dev;
        }
        return false;
      }

      // SWING — waiting for the opposite side.
      if (nowMs - startMs > SHAKE_WINDOW_MS) {
        state = 'IDLE';
        if (Math.abs(dev) > SHAKE_THRESHOLD_DEG) {
          // Still deflected past the window: sustained side-look → posture change.
          baseline = yawDeg;
          debugLog?.(`re-baseline to ${baseline.toFixed(1)} after ${(nowMs - startMs).toFixed(0)}ms`);
        }
        return false;
      }
      if (-firstSide * dev > SHAKE_THRESHOLD_DEG) {
        state = 'IDLE';
        refractoryUntil = nowMs + SHAKE_REFRACTORY_MS;
        debugLog?.(`fire after ${(nowMs - startMs).toFixed(0)}ms`);
        return true;
      }
      return false;
    },
  };
}

// Discrete head-gesture events for volume control. A held tilt repeats its
// step: tilt up = louder, tilt down = quieter, until the head levels out.
// A side-to-side shake is kept as a redundant "quieter" path.
export type HeadGestureEvent = 'tilt-up' | 'tilt-down' | 'shake';

/** Volume step for a head gesture: up = +0.1, down (tilt or shake) = -0.1. */
export function volumeDeltaForGesture(gesture: HeadGestureEvent): number {
  return gesture === 'tilt-up' ? 0.1 : -0.1;
}
