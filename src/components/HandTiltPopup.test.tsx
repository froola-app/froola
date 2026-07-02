import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import HandTiltPopup from './HandTiltPopup';
import type { GestureSignal } from '../engine/types';

function makeSignalRef(signals: GestureSignal[] = []) {
  const ref = { current: signals };
  return ref as React.RefObject<GestureSignal[]>;
}

const turnedRight: GestureSignal = {
  x: 0.5, y: 0.5, present: true, handId: 'right', facing: 'turned',
};
const okRight: GestureSignal = {
  x: 0.5, y: 0.5, present: true, handId: 'right', facing: 'ok',
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('HandTiltPopup', () => {
  it('stays hidden during the grace period', async () => {
    render(<HandTiltPopup signalRef={makeSignalRef([turnedRight])} />);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('appears after a hand stays tilted past the grace period', async () => {
    render(<HandTiltPopup signalRef={makeSignalRef([turnedRight])} />);
    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(screen.getByRole('status').textContent).toContain('right hand');
    expect(screen.getByRole('status').textContent).toContain('turned sideways');
  });

  it('never appears for a brief tilt that recovers within the grace period', async () => {
    const signalRef = makeSignalRef([turnedRight]);
    render(<HandTiltPopup signalRef={signalRef} />);
    await act(async () => { vi.advanceTimersByTime(800); });
    signalRef.current = [okRight];
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('hides after the hand returns to facing the camera', async () => {
    const signalRef = makeSignalRef([turnedRight]);
    render(<HandTiltPopup signalRef={signalRef} />);
    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(screen.getByRole('status')).toBeDefined();

    signalRef.current = [okRight];
    // Still visible during the clear delay…
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole('status')).toBeDefined();
    // …gone once the hand has been ok long enough.
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('describes a pitched left hand with upright guidance', async () => {
    const pitchedLeft: GestureSignal = {
      x: 0.5, y: 0.5, present: true, handId: 'left', facing: 'pitched',
    };
    render(<HandTiltPopup signalRef={makeSignalRef([pitchedLeft])} />);
    await act(async () => { vi.advanceTimersByTime(1400); });
    expect(screen.getByRole('status').textContent).toContain('left hand');
    expect(screen.getByRole('status').textContent).toContain('leaning toward the camera');
  });

  it('ignores tilt while the hand is making a fist', async () => {
    render(<HandTiltPopup signalRef={makeSignalRef([{ ...turnedRight, fist: true }])} />);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
