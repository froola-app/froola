import { describe, it, expect } from 'vitest';
import {
  pitchFromMatrix,
  yawFromMatrix,
  createTiltHoldDetector,
  createShakeDetector,
  volumeDeltaForGesture,
  type TiltEvent,
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

// Feed a pitch trace at 33ms steps (~30Hz); collect fired events with times.
function runTrace(
  det: ReturnType<typeof createTiltHoldDetector>,
  pitches: number[],
  startMs = 0,
): TiltEvent[] {
  return runTimedTrace(det, pitches, startMs).map(([ev]) => ev);
}

function runTimedTrace(
  det: ReturnType<typeof createTiltHoldDetector>,
  pitches: number[],
  startMs = 0,
): Array<[TiltEvent, number]> {
  const events: Array<[TiltEvent, number]> = [];
  pitches.forEach((p, i) => {
    const t = startMs + i * 33;
    const ev = det.sample(p, t);
    if (ev) events.push([ev, t]);
  });
  return events;
}

const IDLE10 = Array(10).fill(0); // seed + settle at baseline 0

describe('createTiltHoldDetector — core detection', () => {
  it('fires "down" ~150ms into a held downward tilt, then repeats every ~400ms', () => {
    const det = createTiltHoldDetector();
    // Hold 15° for 40 samples (~1.3s): engage at t=330, first fire once the
    // hold has lasted ≥150ms (t=495), repeats ≥400ms apart (t=924, t=1353).
    const events = runTrace(det, [...IDLE10, ...Array(40).fill(15), ...Array(10).fill(0)]);
    expect(events).toEqual(['down', 'down', 'down']);
  });

  it('fires "up" repeatedly for the mirrored upward hold', () => {
    const det = createTiltHoldDetector();
    const events = runTrace(det, [...IDLE10, ...Array(40).fill(-15), ...Array(10).fill(0)]);
    expect(events).toEqual(['up', 'up', 'up']);
  });

  it('a short tilt-and-return (~300ms past threshold) fires exactly one step', () => {
    const det = createTiltHoldDetector();
    const tilt = [6, 13, 15, 15, 15, 15, 15, 13, 6, 0];
    const events = runTrace(det, [...IDLE10, ...tilt, ...Array(10).fill(0)]);
    expect(events).toEqual(['down']);
  });

  it('ignores a sub-150ms twitch', () => {
    const det = createTiltHoldDetector();
    const events = runTrace(det, [...IDLE10, 15, 0, ...Array(10).fill(0)]);
    expect(events).toEqual([]);
  });

  it('returning to neutral never fires the opposite direction, even with overshoot', () => {
    const det = createTiltHoldDetector();
    // Hold down, then release with a realistic overshoot past neutral.
    const trace = [...IDLE10, ...Array(20).fill(15), 6, -4, -7, -6, -3, 0, ...Array(10).fill(0)];
    const events = runTrace(det, trace);
    expect(events.every((e) => e === 'down')).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe('createTiltHoldDetector — robustness', () => {
  it('a sustained look-down stops stepping after MAX_HOLD_MS and re-baselines; the return fires nothing', () => {
    const det = createTiltHoldDetector();
    // Held 150 samples (~5s) then return to 0 and settle.
    const timed = runTimedTrace(det, [...IDLE10, ...Array(150).fill(-20), ...Array(30).fill(0)]);
    expect(timed.every(([ev]) => ev === 'up')).toBe(true);
    // No fires after the 4s hold cap (engage at t=330 + 4000 = 4330).
    expect(timed.every(([, t]) => t <= 4330)).toBe(true);
  });

  it('never fires on small jitter around baseline', () => {
    const det = createTiltHoldDetector();
    const jitter = Array.from({ length: 90 }, (_, i) => 3 * Math.sin(i * 1.3)); // ±3° for ~3s
    expect(runTrace(det, [0, ...jitter])).toEqual([]);
  });

  it('release starts a refractory: an immediate re-tilt is suppressed, a spaced one fires', () => {
    const tilt = [13, ...Array(8).fill(15), 6, 0];
    // Re-tilt ~66ms after release → suppressed.
    const det = createTiltHoldDetector();
    expect(runTrace(det, [...IDLE10, ...tilt, 0, ...tilt])).toEqual(['down']);
    // Re-tilt after >500ms at baseline (16 samples ≈ 528ms) → fires again.
    const det2 = createTiltHoldDetector();
    const spaced = [...IDLE10, ...tilt, ...Array(16).fill(0), ...tilt, ...Array(5).fill(0)];
    expect(runTrace(det2, spaced)).toEqual(['down', 'down']);
  });

  it('absorbs slow posture drift without firing', () => {
    const det = createTiltHoldDetector();
    const drift = Array.from({ length: 100 }, (_, i) => i * 0.1); // 0.1°/sample, 10° total
    expect(runTrace(det, drift)).toEqual([]);
  });

  it('reset() re-seeds: a new resting pitch after reset does not fire', () => {
    const det = createTiltHoldDetector();
    runTrace(det, IDLE10);          // seeded at 0
    det.reset();                    // face lost
    const events = runTrace(det, Array(10).fill(-30), 10 * 33);
    expect(events).toEqual([]);
  });

  it('adapts a settled off-baseline posture (slow EMA) so a tilt toward baseline still fires', () => {
    const det = createTiltHoldDetector();
    const settle = Array(400).fill(8);
    // Tilt from the new posture: down to -7° (dev ~-14.8° from the ~7.8°
    // baseline), held past 150ms, back to 8°.
    const tilt = [...Array(8).fill(-7), 8, 8, 8];
    const events = runTrace(det, [0, ...settle, ...tilt]);
    expect(events).toEqual(['up']);
  });

  it('ignores NaN samples — no poisoned baseline, seeds normally once real data arrives', () => {
    const det = createTiltHoldDetector();
    expect(runTrace(det, [NaN, NaN, NaN])).toEqual([]);
    const tilt = [6, 13, ...Array(6).fill(15), 6, 0];
    const events = runTrace(det, [...IDLE10, ...tilt, ...Array(10).fill(0)], 3 * 33);
    expect(events).toEqual(['down']);
  });

  it('suppress() blocks a tilt inside the refractory window, allows one after', () => {
    const tilt = [13, ...Array(8).fill(15), 6, 0];
    const det = createTiltHoldDetector();
    runTrace(det, IDLE10); // seeded, last sample at t = 9 × 33 = 297ms
    det.suppress(297);
    expect(runTrace(det, [...tilt, ...Array(3).fill(0)], 10 * 33)).toEqual([]);
    expect(runTrace(det, [...tilt, ...Array(3).fill(0)], 297 + 550)).toEqual(['down']);
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
  it('tilt-up raises volume', () => {
    expect(volumeDeltaForGesture('tilt-up')).toBeCloseTo(0.1);
  });

  it('tilt-down lowers volume', () => {
    expect(volumeDeltaForGesture('tilt-down')).toBeCloseTo(-0.1);
  });

  it('shake lowers volume (redundant secondary path)', () => {
    expect(volumeDeltaForGesture('shake')).toBeCloseTo(-0.1);
  });
});
