import { describe, it, expect, vi, beforeEach } from 'vitest';

const closeFn = vi.fn();
const createFromOptions = vi.fn();
const forVisionTasks = vi.fn();

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks },
  HandLandmarker: { createFromOptions },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules(); // fresh singleton per test
  forVisionTasks.mockResolvedValue({ wasm: true });
  createFromOptions.mockResolvedValue({ close: closeFn });
});

async function freshWarm() {
  return await import('./warm');
}

describe('warm/obtain singleton', () => {
  it('warm then obtain share a single load', async () => {
    const { warmGestureInput, obtainHandTracking } = await freshWarm();
    warmGestureInput();
    warmGestureInput(); // idempotent
    const t = await obtainHandTracking();
    expect(forVisionTasks).toHaveBeenCalledTimes(1);
    expect(createFromOptions).toHaveBeenCalledTimes(1);
    expect(t.landmarker).toBeDefined();
  });

  it('obtain transfers ownership: second obtain starts a fresh load', async () => {
    const { warmGestureInput, obtainHandTracking } = await freshWarm();
    warmGestureInput();
    await obtainHandTracking();
    await obtainHandTracking();
    expect(forVisionTasks).toHaveBeenCalledTimes(2);
  });

  it('cold obtain works with no prior warm', async () => {
    const { obtainHandTracking } = await freshWarm();
    const t = await obtainHandTracking();
    expect(t.createLandmarker).toBeTypeOf('function');
    expect(forVisionTasks).toHaveBeenCalledTimes(1);
  });

  it('a rejected warm clears itself so the next call retries fresh', async () => {
    const { warmGestureInput, obtainHandTracking } = await freshWarm();
    forVisionTasks.mockRejectedValueOnce(new Error('cdn down'));
    warmGestureInput();
    // let the rejection settle and self-clear
    await new Promise(r => setTimeout(r, 0));
    const t = await obtainHandTracking(); // retries, succeeds
    expect(t.landmarker).toBeDefined();
    expect(forVisionTasks).toHaveBeenCalledTimes(2);
  });

  it('falls back to CPU when the initial delegate creation throws', async () => {
    const { obtainHandTracking } = await freshWarm();
    createFromOptions
      .mockRejectedValueOnce(new Error('no gpu'))
      .mockResolvedValueOnce({ close: closeFn });
    const t = await obtainHandTracking();
    expect(t.delegate).toBe('CPU');
    expect(createFromOptions).toHaveBeenCalledTimes(2);
  });

  it('restash puts an abandoned load back for the next obtain to reuse', async () => {
    const { obtainHandTracking, restashHandTracking } = await freshWarm();
    const p = obtainHandTracking(); // takes ownership, cache now empty
    const took = restashHandTracking(p);
    expect(took).toBe(true);
    const t = await obtainHandTracking(); // should reuse the restashed load, not start a new one
    expect(t.landmarker).toBeDefined();
    expect(forVisionTasks).toHaveBeenCalledTimes(1);
    expect(createFromOptions).toHaveBeenCalledTimes(1);
  });

  it('restash does not clobber an already-pending load', async () => {
    const { obtainHandTracking, restashHandTracking } = await freshWarm();
    // Two dummy loads standing in for real HandTracking promises — this
    // isolates the restash guard itself (only cache-state matters, not the
    // real load() pipeline) so the test doesn't have to run two real,
    // concurrently-in-flight loads through the mocked module loader.
    const dummyA = Promise.resolve({ landmarker: { close: vi.fn() }, delegate: 'CPU' as const, createLandmarker: vi.fn() });
    const dummyB = Promise.resolve({ landmarker: { close: vi.fn() }, delegate: 'GPU' as const, createLandmarker: vi.fn() });
    expect(restashHandTracking(dummyB)).toBe(true); // nothing cached yet: dummyB becomes pending
    const took = restashHandTracking(dummyA); // should not overwrite the already-pending dummyB
    expect(took).toBe(false);
    const t = await obtainHandTracking(); // should get dummyB, not dummyA
    expect(t.delegate).toBe('GPU');
    expect(forVisionTasks).not.toHaveBeenCalled(); // no real load was ever triggered
  });
});
