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
});
