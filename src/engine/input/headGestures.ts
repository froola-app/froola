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
export const DEFLECT_THRESHOLD_DEG = 8;  // deviation that starts a nod
export const RETURN_THRESHOLD_DEG = 5;   // deviation below this always completes a nod
export const RETURN_FRACTION = 0.5;      // ...or once the head is back within this fraction of peak deflection (fires earlier on big nods)
export const MIN_NOD_MS = 100;           // faster return = jitter, not a nod
export const MAX_NOD_MS = 900;           // no return by now = posture change
export const REFRACTORY_MS = 500;        // no new deflection after a fire

export type NodEvent = 'up' | 'down';

export interface NodDetector {
  sample(pitchDeg: number, nowMs: number): NodEvent | null;
  /** Mutual suppression: abort any in-flight nod and hold off for the refractory period. */
  suppress(nowMs: number): void;
  reset(): void;
}

export function createNodDetector(debugLog?: (msg: string) => void): NodDetector {
  let seeded = false;
  let baseline = 0;
  let state: 'IDLE' | 'DEFLECTED' = 'IDLE';
  let direction: NodEvent = 'down';
  let startMs = 0;
  let peakDev = 0;
  let refractoryUntil = -Infinity;

  return {
    reset() {
      seeded = false;
      state = 'IDLE';
      refractoryUntil = -Infinity;
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
          state = 'DEFLECTED';
          direction = dev > 0 ? 'down' : 'up';
          startMs = nowMs;
          peakDev = Math.abs(dev);
          debugLog?.(`deflect ${direction} dev=${dev.toFixed(1)} baseline=${baseline.toFixed(1)}`);
        } else {
          // Outside the band but not deflecting (either mid-band-to-threshold,
          // or blocked by the refractory period): adapt slowly so a settled
          // posture eventually re-centers instead of freezing the baseline
          // forever, without polluting it during a real nod's rising edge.
          baseline += BASELINE_SLOW_ALPHA * dev;
        }
        return null;
      }

      // DEFLECTED
      const elapsed = nowMs - startMs;
      if (elapsed > MAX_NOD_MS) {
        // Posture change (e.g. looking down at hands), not a nod.
        baseline = pitchDeg;
        state = 'IDLE';
        debugLog?.(`re-baseline to ${baseline.toFixed(1)} after ${elapsed}ms`);
        return null;
      }
      peakDev = Math.max(peakDev, Math.abs(dev));
      // Fire as soon as the head is clearly on its way back: fully inside
      // the return threshold, or (for bigger nods) back within half of the
      // peak deflection — waiting for the full return reads as lag.
      if (Math.abs(dev) < RETURN_THRESHOLD_DEG || Math.abs(dev) <= RETURN_FRACTION * peakDev) {
        state = 'IDLE';
        if (elapsed >= MIN_NOD_MS) {
          refractoryUntil = nowMs + REFRACTORY_MS;
          debugLog?.(`fire ${direction} after ${elapsed}ms`);
          return direction;
        }
        return null; // twitch
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
