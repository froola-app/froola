// Head-nod detection on the pitch angle extracted from MediaPipe's facial
// transformation matrix. Pure module: no React, no MediaPipe, no DOM.

/**
 * Pitch in degrees from a 16-element column-major 4x4 head-pose matrix.
 * R[row][col] = data[col*4 + row]; pitch = atan2(R[2][1], R[2][2]).
 * Contract: a pure rotation about the x-axis by θ returns θ.
 * Both atan2 terms scale with cos(yaw), so pitch extraction attenuates at
 * large yaw — a side-facing nod reads as a smaller pitch swing than a
 * face-on one.
 */
export function pitchFromMatrix(data: ArrayLike<number>): number {
  return Math.atan2(data[6], data[10]) * (180 / Math.PI);
}

export const BASELINE_ALPHA = 0.02;      // baseline EMA weight (~2s time constant at 30Hz)
export const BASELINE_SLOW_ALPHA = 0.002; // baseline EMA weight outside the band (BASELINE_ALPHA / 10)
export const BASELINE_BAND_DEG = 5;      // baseline only adapts inside this band
export const DEFLECT_THRESHOLD_DEG = 12; // deviation that starts a nod
export const RETURN_THRESHOLD_DEG = 5;   // deviation must drop below this to complete
export const MIN_NOD_MS = 150;           // faster return = jitter, not a nod
export const MAX_NOD_MS = 900;           // no return by now = posture change
export const REFRACTORY_MS = 500;        // no new deflection after a fire

export type NodEvent = 'up' | 'down';

export interface NodDetector {
  sample(pitchDeg: number, nowMs: number): NodEvent | null;
  reset(): void;
}

export function createNodDetector(debugLog?: (msg: string) => void): NodDetector {
  let seeded = false;
  let baseline = 0;
  let state: 'IDLE' | 'DEFLECTED' = 'IDLE';
  let direction: NodEvent = 'down';
  let startMs = 0;
  let refractoryUntil = -Infinity;

  return {
    reset() {
      seeded = false;
      state = 'IDLE';
      refractoryUntil = -Infinity;
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
      if (Math.abs(dev) < RETURN_THRESHOLD_DEG) {
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
