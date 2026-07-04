import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENCOURAGEMENTS, pickPhrase, useEncouragement } from './encouragement';

describe('pickPhrase', () => {
  it('returns a phrase from the pool', () => {
    expect(ENCOURAGEMENTS).toContain(pickPhrase(null, () => 0));
  });

  it('never returns the immediately-previous phrase', () => {
    // Force the RNG to land on the previous phrase's index; pickPhrase must
    // still skip it and return something different.
    const prev = ENCOURAGEMENTS[0];
    for (let i = 0; i < 50; i++) {
      const next = pickPhrase(prev, () => 0);
      expect(next).not.toBe(prev);
    }
  });
});

describe('useEncouragement', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render(initialScore: number, active = true) {
    return renderHook(
      ({ score, on }: { score: number; on: boolean }) => useEncouragement(score, on),
      { initialProps: { score: initialScore, on: active } },
    );
  }

  it('starts with no phrase', () => {
    const { result } = render(0);
    expect(result.current).toBeNull();
  });

  it('shows a phrase after the score holds >= 75', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).not.toBeNull();
    expect(ENCOURAGEMENTS).toContain(result.current);
  });

  it('ignores a sub-hold spike above 75', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(300); }); // less than the ~500ms hold
    rerender({ score: 40, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).toBeNull();
  });

  it('clears once the score drops below 60', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).not.toBeNull();
    rerender({ score: 55, on: true });
    act(() => { vi.advanceTimersByTime(100); }); // next poll tick sees the drop
    expect(result.current).toBeNull();
  });

  it('stays on when the score dips only into the hysteresis band', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    const phrase = result.current;
    expect(phrase).not.toBeNull();
    rerender({ score: 65, on: true }); // below 75 on-threshold but above 60 off-threshold
    expect(result.current).toBe(phrase);
  });

  it('rotates to a new phrase while sustained', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    const first = result.current;
    act(() => { vi.advanceTimersByTime(4000); });
    rerender({ score: 90, on: true });
    expect(result.current).not.toBe(first);
    expect(ENCOURAGEMENTS).toContain(result.current);
  });

  it('resets when it becomes inactive', () => {
    const { result, rerender } = render(0);
    rerender({ score: 90, on: true });
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).not.toBeNull();
    rerender({ score: 90, on: false });
    expect(result.current).toBeNull();
  });
});
