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
  it('shows step 1 headline on first render in camera mode', () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();
  });

  it('shows step 2 in mouse mode (skips camera step)', () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="mouse"
      />
    );
    expect(screen.getByText('Play the left circle')).toBeDefined();
  });

  it('advances from step 1 when a hand signal is present', async () => {
    const signalRef = makeSignalRef([]);
    render(
      <BeginnerTutorial
        signalRef={signalRef}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    expect(screen.getByText('Hold your hands up')).toBeDefined();

    // Trigger detection: the 100ms interval fires and sees a hand signal.
    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];

    // Advance to t=150ms so the 100ms interval fires and sees the hand.
    // This registers a 800ms flash-timeout (fires at t=900ms) and sets flashComplete.
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(screen.getByText('✓')).toBeDefined();

    // Advance to t=910ms: fires the 800ms timeout (t=900ms) but stops before
    // the next interval tick (t=1000ms) so the stale-closure can't re-detect.
    // act() flushes React updates so the new step renders before we assert.
    await act(async () => { vi.advanceTimersByTime(760); });

    expect(screen.getByText('Touch the left circle')).toBeDefined();
  });

  it('sets localStorage flag and unmounts when skip is clicked', async () => {
    render(
      <BeginnerTutorial
        signalRef={makeSignalRef()}
        selectedRef={makeSelectedRef()}
        mode="camera"
      />
    );
    screen.getByText('Skip tutorial').click();
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(screen.queryByText('Hold your hands up')).toBeNull();
  });
});
