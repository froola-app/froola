import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import BeginnerTutorial from './BeginnerTutorial';
import type { GestureSignal } from '../engine/types';
import type { DialSelection } from '../engine/renderer';

// jsdom has no real layout so wheelGeometry returns zeroes — mock it
vi.mock('../engine/renderer/geometry', () => ({
  wheelGeometry: () => ({ outerR: 100, innerR: 36, leftCx: 150, rightCx: 850, cy: 468 }),
}));

function makeSignalRef(signals: GestureSignal[] = []) {
  const ref = { current: signals };
  return ref as React.RefObject<GestureSignal[]>;
}
function makeSelectedRef(noteIdx = 0) {
  return { current: { noteIdx, qualIdx: 0 } } as React.RefObject<DialSelection>;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BeginnerTutorial', () => {
  it('shows step 1 headline on first render', () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();
  });

  it('advances from step 1 after the hand is present past the pacing guards', async () => {
    const signalRef = makeSignalRef([]);
    render(
      <BeginnerTutorial
        signalRef={signalRef}
        selectedRef={makeSelectedRef()}
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();

    // Hand visible from the very first tick — the old bug: this used to
    // advance within 100ms, so the tutorial "started on 2/4".
    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];

    // Well before MIN_STEP_MS (2000ms) the step must still be on screen.
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(screen.getByText('Hold your hands up')).toBeDefined();

    // Past the 2s minimum + 600ms hold, the checkmark flash plays…
    await act(async () => { vi.advanceTimersByTime(700); });
    expect(screen.getByText('✓')).toBeDefined();

    // …and 800ms later (flash started at t=2000; stop at t=2850, before the
    // t=2900 tick so the stale interval closure can't re-detect) step 2 renders.
    await act(async () => { vi.advanceTimersByTime(650); });
    expect(screen.getByText('Touch the left circle')).toBeDefined();
  });

  it('does not advance when the hand only appears briefly', async () => {
    const signalRef = makeSignalRef([]);
    render(
      <BeginnerTutorial
        signalRef={signalRef}
        selectedRef={makeSelectedRef()}
      />
    );
    // Hand flickers in for 200ms then disappears.
    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];
    await act(async () => { vi.advanceTimersByTime(200); });
    signalRef.current = [];
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText('Hold your hands up')).toBeDefined();
  });

  it('keeps the skip button clickable during the checkmark flash', async () => {
    const signalRef = makeSignalRef([]);
    render(
      <BeginnerTutorial
        signalRef={signalRef}
        selectedRef={makeSelectedRef()}
      />
    );
    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];
    await act(async () => { vi.advanceTimersByTime(2200); });
    expect(screen.getByText('✓')).toBeDefined();
    act(() => { screen.getByText('Skip tutorial').click(); });
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('sets localStorage flag and unmounts when skip is clicked', async () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
      />
    );
    screen.getByText('Skip tutorial').click();
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(screen.queryByText('Hold your hands up')).toBeNull();
  });
});
