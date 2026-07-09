import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreenBlackout } from './useScreenBlackout';

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
}
function setHasFocus(focused: boolean) {
  vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
}

beforeEach(() => {
  vi.useFakeTimers();
  setHidden(false);
  setHasFocus(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useScreenBlackout', () => {
  it('starts false when active and focused/visible', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    expect(result.current).toBe(false);
  });

  it('never attaches listeners or returns true when inactive', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { result } = renderHook(() => useScreenBlackout(false));
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);
    expect(addSpy).not.toHaveBeenCalledWith('blur', expect.any(Function));
  });

  it('goes true on document.hidden via visibilitychange', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
  });

  it('clears when visibility returns and focus is present', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
    act(() => {
      setHidden(false);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);
  });

  it('goes true on window blur, clears on window focus', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    act(() => {
      setHasFocus(false);
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current).toBe(true);
    act(() => {
      setHasFocus(true);
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(false);
  });

  it('goes true on PrintScreen keydown and auto-clears after ~1.5s', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PrintScreen' }));
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBe(false);
  });

  it('ignores unrelated keydowns', () => {
    const { result } = renderHook(() => useScreenBlackout(true));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current).toBe(false);
  });
});
