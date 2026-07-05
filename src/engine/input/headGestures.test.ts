import { describe, it, expect } from 'vitest';
import {
  pitchFromMatrix,
  yawFromMatrix,
  createNodDetector,
  createShakeDetector,
  volumeDeltaForGesture,
  type NodEvent,
} from './headGestures';

// Column-major 4x4 rotation about the x-axis by `deg` degrees.
// Rx = [[1,0,0],[0,c,-s],[0,s,c]]; column-major layout: data[col*4 + row].
function rx(deg: number): Float32Array {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return new Float32Array([
    1, 0,  0, 0, // col 0
    0, c,  s, 0, // col 1
    0, -s, c, 0, // col 2
    0, 0,  0, 1, // col 3
  ]);
}

describe('pitchFromMatrix', () => {
  it('returns 0 for the identity matrix', () => {
    expect(pitchFromMatrix(rx(0))).toBeCloseTo(0, 5);
  });

  it('returns +20 for a +20° rotation about x', () => {
    expect(pitchFromMatrix(rx(20))).toBeCloseTo(20, 5);
  });

  it('returns -20 for a -20° rotation about x', () => {
    expect(pitchFromMatrix(rx(-20))).toBeCloseTo(-20, 5);
  });
});

// Feed a pitch trace at 33ms steps (~30Hz); collect fired events.
function runTrace(
  det: ReturnType<typeof createNodDetector>,
  pitches: number[],
  startMs = 0,
): NodEvent[] {
  const events: NodEvent[] = [];
  pitches.forEach((p, i) => {
    const ev = det.sample(p, startMs + i * 33);
    if (ev) events.push(ev);
  });
  return events;
}

const IDLE10 = Array(10).fill(0); // seed + settle at baseline 0

describe('createNodDetector — core detection', () => {
  it('fires exactly one "down" for a fast (~300ms) downward nod', () => {
    const det = createNodDetector();
    // deflect past 12°, hold, return to baseline: ~9 samples ≈ 300ms
    const nod = [6, 13, 15, 15, 15, 13, 6, 0, 0];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(0)]);
    expect(events).toEqual(['down']);
  });

  it('fires exactly one "up" for the mirrored upward nod', () => {
    const det = createNodDetector();
    const nod = [-6, -13, -15, -15, -15, -13, -6, 0, 0];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(0)]);
    expect(events).toEqual(['up']);
  });

  it('fires for a slow deliberate nod (~800ms)', () => {
    const det = createNodDetector();
    const nod = [13, ...Array(20).fill(15), 6, 0]; // ~23 samples ≈ 760ms deflected
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(5).fill(0)]);
    expect(events).toEqual(['down']);
  });

  it('ignores a sub-150ms twitch', () => {
    const det = createNodDetector();
    // deflected for a single 33ms sample, back at baseline immediately
    const events = runTrace(det, [...IDLE10, 15, 0, ...Array(10).fill(0)]);
    expect(events).toEqual([]);
  });
});

describe('createNodDetector — robustness', () => {
  it('sustained look-down re-baselines silently; nods from new posture work', () => {
    const det = createNodDetector();
    const lookDown = Array(35).fill(-20);            // > 900ms deflected → re-baseline
    const settle = Array(10).fill(-20);              // idle at new posture
    const nod = [-26, -35, -35, -35, -35, -26, -20]; // dev −15 from new baseline
    const events = runTrace(det, [...IDLE10, ...lookDown, ...settle, ...nod, ...Array(10).fill(-20)]);
    expect(events).toEqual(['up']); // only the deliberate nod, nothing from the posture change
  });

  it('never fires on small jitter around baseline', () => {
    const det = createNodDetector();
    const jitter = Array.from({ length: 90 }, (_, i) => 3 * Math.sin(i * 1.3)); // ±3° for ~3s
    expect(runTrace(det, [0, ...jitter])).toEqual([]);
  });

  it('suppresses a second nod inside the 500ms refractory, allows it after', () => {
    const det = createNodDetector();
    const nod = [13, 15, 15, 15, 13, 6, 0];
    // Immediately repeated nod: second deflection starts ~66ms after the fire → suppressed.
    const backToBack = [...IDLE10, ...nod, 0, ...nod];
    expect(runTrace(det, backToBack)).toEqual(['down']);
    // Same second nod but after a >500ms gap at baseline (16 samples ≈ 528ms) → fires.
    const det2 = createNodDetector();
    const spaced = [...IDLE10, ...nod, ...Array(16).fill(0), ...nod, ...Array(5).fill(0)];
    expect(runTrace(det2, spaced)).toEqual(['down', 'down']);
  });

  it('absorbs slow posture drift without firing', () => {
    const det = createNodDetector();
    const drift = Array.from({ length: 100 }, (_, i) => i * 0.1); // 0.1°/sample, 10° total
    expect(runTrace(det, drift)).toEqual([]);
  });

  it('reset() re-seeds: a new resting pitch after reset does not fire', () => {
    const det = createNodDetector();
    runTrace(det, IDLE10);          // seeded at 0
    det.reset();                    // face lost
    // Face reacquired at a very different pitch — must seed, not deflect.
    const events = runTrace(det, Array(10).fill(-30), 10 * 33);
    expect(events).toEqual([]);
  });

  it('adapts a settled off-baseline posture (slow EMA) so a nod toward baseline still fires', () => {
    const det = createNodDetector();
    // Seed at 0, then settle at +8° — the off-baseline posture the original
    // design left frozen forever. ~400 samples at 33ms lets the slow EMA
    // (0.002 outside the 5° band, 0.02 once inside it) converge the
    // baseline to within a fraction of a degree of 8.
    const settle = Array(400).fill(8);
    // Nod from the new posture: down to -7° (dev from the ~7.8° baseline is
    // ~-14.8°, past the deflection threshold) and back to 8°.
    const nod = [-7, -7, -7, -7, -7, 8, 8, 8];
    const events = runTrace(det, [0, ...settle, ...nod]);
    expect(events).toEqual(['up']);
  });

  it('ignores NaN samples — no poisoned baseline, seeds normally once real data arrives', () => {
    const det = createNodDetector();
    const nanEvents = runTrace(det, [NaN, NaN, NaN]);
    expect(nanEvents).toEqual([]);
    // The NaNs must not have seeded or otherwise perturbed state: the next
    // real sample seeds fresh, and detection works exactly as in the
    // baseline fast-nod case.
    const nod = [6, 13, 15, 15, 15, 13, 6, 0, 0];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(0)], 3 * 33);
    expect(events).toEqual(['down']);
  });

  it('fires early once the head is back within half of peak deflection, without a full return', () => {
    const det = createNodDetector();
    // Deflect to 16° (peak), then hover at 7° — never inside the 5° return
    // threshold, but 7 ≤ 0.5 × 16, so the half-of-peak rule fires. Elapsed at
    // the 7° sample is 4 × 33 = 132ms ≥ MIN_NOD_MS.
    const nod = [10, 16, 16, 16, 7];
    const events = runTrace(det, [...IDLE10, ...nod, ...Array(10).fill(7)]);
    expect(events).toEqual(['down']);
  });

  it('suppress() blocks a nod inside the refractory window, allows one after', () => {
    const nod = [13, 15, 15, 15, 13, 6, 0];
    const det = createNodDetector();
    runTrace(det, IDLE10); // seeded, last sample at t = 9 × 33 = 297ms
    det.suppress(297);
    // Nod starting on the very next sample (~33ms later) → inside refractory.
    expect(runTrace(det, [...nod, ...Array(3).fill(0)], 10 * 33)).toEqual([]);
    // Same nod starting >500ms after the suppress → fires.
    expect(runTrace(det, [...nod, ...Array(3).fill(0)], 297 + 550)).toEqual(['down']);
  });
});

// Column-major 4x4 rotation about the y-axis by `deg` degrees.
// Ry = [[c,0,s],[0,1,0],[-s,0,c]]; column-major layout: data[col*4 + row].
function ry(deg: number): Float32Array {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return new Float32Array([
    c, 0, -s, 0, // col 0
    0, 1,  0, 0, // col 1
    s, 0,  c, 0, // col 2
    0, 0,  0, 1, // col 3
  ]);
}

// Column-major 4x4 product a·b.
function matmul(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

describe('yawFromMatrix', () => {
  it('returns 0 for the identity matrix', () => {
    expect(yawFromMatrix(ry(0))).toBeCloseTo(0, 5);
  });

  it('returns +25 for a +25° rotation about y', () => {
    expect(yawFromMatrix(ry(25))).toBeCloseTo(25, 5);
  });

  it('returns -25 for a -25° rotation about y', () => {
    expect(yawFromMatrix(ry(-25))).toBeCloseTo(-25, 5);
  });
});

describe('compound rotation (yaw ∘ pitch)', () => {
  it('recovers both angles exactly from Ry(30)·Rx(20)', () => {
    const m = matmul(ry(30), rx(20));
    expect(pitchFromMatrix(m)).toBeCloseTo(20, 4);
    expect(yawFromMatrix(m)).toBeCloseTo(30, 4);
  });

  it('recovers both angles exactly from Ry(-30)·Rx(-20)', () => {
    const m = matmul(ry(-30), rx(-20));
    expect(pitchFromMatrix(m)).toBeCloseTo(-20, 4);
    expect(yawFromMatrix(m)).toBeCloseTo(-30, 4);
  });
});

// Feed a yaw trace at 33ms steps (~30Hz); count fired shakes.
function runShakeTrace(
  det: ReturnType<typeof createShakeDetector>,
  yaws: number[],
  startMs = 0,
): number {
  let fires = 0;
  yaws.forEach((y, i) => {
    if (det.sample(y, startMs + i * 33)) fires++;
  });
  return fires;
}

// One full head-shake around a `center` yaw: swing past +8° then past −8°
// within ~200ms, then settle back.
const shakeAround = (center: number) =>
  [10, 12, 4, -10, -12, -4, 0, 0].map(d => center + d);

describe('createShakeDetector — core detection', () => {
  it('fires exactly once for a two-sided swing within the window', () => {
    const det = createShakeDetector();
    expect(runShakeTrace(det, [...IDLE10, ...shakeAround(0), ...Array(10).fill(0)])).toBe(1);
  });

  it('fires exactly once when the shake keeps oscillating (sustained shake)', () => {
    const det = createShakeDetector();
    // Two full left-right cycles back to back — second opposite-crossing lands
    // ~300ms after the fire, inside the 700ms refractory.
    const sustained = [10, 12, 4, -10, -12, -4, 4, 10, 12, 4, -10, -4, 0, 0];
    expect(runShakeTrace(det, [...IDLE10, ...sustained, ...Array(10).fill(0)])).toBe(1);
  });

  it('never fires on a one-sided glance (out and back on the same side)', () => {
    const det = createShakeDetector();
    const glance = [6, 12, 15, 15, 15, 12, 6, 0];
    expect(runShakeTrace(det, [...IDLE10, ...glance, ...Array(10).fill(0)])).toBe(0);
  });

  it('never fires when the two sides are crossed more than the window apart', () => {
    const det = createShakeDetector();
    // Left cross, back to center for ~750ms, then right cross — too slow.
    const slow = [12, 12, ...Array(23).fill(0), -12, -12, ...Array(10).fill(0)];
    expect(runShakeTrace(det, [...IDLE10, ...slow])).toBe(0);
  });
});

describe('createShakeDetector — robustness', () => {
  it('sustained side-look re-baselines silently; a shake from the new posture fires', () => {
    const det = createShakeDetector();
    const lookAside = Array(35).fill(20); // > window deflected → re-baseline
    const settle = Array(10).fill(20);
    const trace = [...IDLE10, ...lookAside, ...settle, ...shakeAround(20), ...Array(10).fill(20)];
    expect(runShakeTrace(det, trace)).toBe(1);
  });

  it('suppresses a second shake inside the refractory, allows it after', () => {
    const det = createShakeDetector();
    // Back-to-back shakes ~130ms apart → one fire.
    expect(runShakeTrace(det, [...IDLE10, ...shakeAround(0), ...shakeAround(0), ...Array(5).fill(0)])).toBe(1);
    // Spaced >700ms apart at baseline → both fire.
    const det2 = createShakeDetector();
    const spaced = [...IDLE10, ...shakeAround(0), ...Array(25).fill(0), ...shakeAround(0), ...Array(5).fill(0)];
    expect(runShakeTrace(det2, spaced)).toBe(2);
  });

  it('never fires on small jitter around baseline', () => {
    const det = createShakeDetector();
    const jitter = Array.from({ length: 90 }, (_, i) => 3 * Math.sin(i * 1.3));
    expect(runShakeTrace(det, [0, ...jitter])).toBe(0);
  });

  it('suppress() blocks a shake inside the refractory window, allows one after', () => {
    const det = createShakeDetector();
    runShakeTrace(det, IDLE10); // seeded, last sample at 297ms
    det.suppress(297);
    expect(runShakeTrace(det, [...shakeAround(0), ...Array(3).fill(0)], 10 * 33)).toBe(0);
    expect(runShakeTrace(det, [...shakeAround(0), ...Array(3).fill(0)], 297 + 750)).toBe(1);
  });

  it('ignores NaN samples and seeds normally once real data arrives', () => {
    const det = createShakeDetector();
    expect(runShakeTrace(det, [NaN, NaN, NaN])).toBe(0);
    expect(runShakeTrace(det, [...IDLE10, ...shakeAround(0), ...Array(10).fill(0)], 3 * 33)).toBe(1);
  });

  it('reset() re-seeds: a new resting yaw after reset does not fire', () => {
    const det = createShakeDetector();
    runShakeTrace(det, IDLE10);
    det.reset(); // face lost
    expect(runShakeTrace(det, Array(10).fill(-30), 10 * 33)).toBe(0);
  });
});

describe('volumeDeltaForGesture', () => {
  it('nod-up raises volume', () => {
    expect(volumeDeltaForGesture('nod-up')).toBeCloseTo(0.1);
  });

  it('nod-down lowers volume', () => {
    expect(volumeDeltaForGesture('nod-down')).toBeCloseTo(-0.1);
  });

  it('shake lowers volume (redundant secondary path)', () => {
    expect(volumeDeltaForGesture('shake')).toBeCloseTo(-0.1);
  });
});
