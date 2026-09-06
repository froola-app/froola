import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import type { DialSelection } from '../renderer';
import { useRecorder } from './useRecorder';
import { saveRecordingCapped } from './recordingStore';

vi.mock('./recordingStore', () => ({
  saveRecordingCapped: vi.fn().mockResolvedValue(null),
}));

function makeRef(sel: DialSelection = { noteIdx: 0, qualIdx: 0 }): RefObject<DialSelection> {
  return { current: sel };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRecorder', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsed).toBe(0);
    expect(result.current.shareUrl).toBeNull();
  });

  it('transitions to recording on start()', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
  });

  it('transitions to done on stop() and sets shareUrl', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.state).toBe('done');
    expect(result.current.shareUrl).toMatch(/\/replay\?d=/);
  });

  it('calls saveRecordingCapped with the encoded payload, totalMs, and cap on stop()', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm', 20_000, true, 1));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(saveRecordingCapped).toHaveBeenCalledOnce();
    const [encoded, totalMs, cap] = vi.mocked(saveRecordingCapped).mock.calls[0];
    expect(typeof encoded).toBe('string');
    expect(totalMs).toBeGreaterThanOrEqual(0);
    expect(cap).toBe(1);
  });

  it('shareUrl contains a non-empty base64url payload', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    const url = result.current.shareUrl!;
    const d = new URL(url).searchParams.get('d');
    expect(d).toBeTruthy();
  });

  it('auto-stops when elapsed reaches maxDurationMs', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    try {
      const { result } = renderHook(() => useRecorder(makeRef(), 'warm', 20_000));
      act(() => { result.current.start(); });
      act(() => { vi.advanceTimersByTime(19_900); });
      expect(result.current.state).toBe('recording');
      act(() => { vi.advanceTimersByTime(10_000); });
      expect(result.current.state).toBe('done');
      expect(result.current.elapsed).toBeLessThanOrEqual(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it('increments saveTick only after the save promise resolves', async () => {
    let resolveSave!: (id: string | null) => void;
    vi.mocked(saveRecordingCapped).mockReturnValueOnce(
      new Promise(resolve => { resolveSave = resolve; })
    );
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    expect(result.current.saveTick).toBe(0);
    await act(async () => {
      resolveSave(null);
      await Promise.resolve();
    });
    expect(result.current.saveTick).toBe(1);
  });

  it('can start again after done', () => {
    const { result } = renderHook(() => useRecorder(makeRef(), 'warm'));
    act(() => { result.current.start(); });
    act(() => { result.current.stop(); });
    act(() => { result.current.start(); });
    expect(result.current.state).toBe('recording');
    expect(result.current.shareUrl).toBeNull();
  });
});
