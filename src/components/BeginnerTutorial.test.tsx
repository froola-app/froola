import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import BeginnerTutorial from './BeginnerTutorial';
import type { GestureSignal } from '../engine/types';
import { wheelGeometry } from '../engine/renderer/geometry';

// jsdom has no real layout so wheelGeometry returns zeroes — mock it
vi.mock('../engine/renderer/geometry', () => ({
  wheelGeometry: () => ({ outerR: 100, innerR: 36, leftCx: 150, rightCx: 850, leftCy: 468, rightCy: 468, cy: 468 }),
}));

function makeSignalRef(signals: GestureSignal[] = []) {
  const ref = { current: signals };
  return ref as React.RefObject<GestureSignal[]>;
}

function leftHandOnWheel(): GestureSignal {
  const g = wheelGeometry(window.innerWidth, window.innerHeight);
  const r = (g.innerR + g.outerR) / 2;
  return {
    handId: 'left',
    present: true,
    x: (g.leftCx + r) / window.innerWidth,
    y: g.leftCy / window.innerHeight,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BeginnerTutorial', () => {
  it('shows the single prompt', () => {
    render(<BeginnerTutorial signalRef={makeSignalRef()} />);
    expect(screen.getByText('Hold your hands up')).toBeInTheDocument();
    expect(screen.queryByText(/1\s*\/\s*4/)).toBeNull();
  });

  it('dissolves and fires onDone once the first chord condition holds', () => {
    const onDone = vi.fn();
    const signalRef = makeSignalRef([leftHandOnWheel()]);
    render(<BeginnerTutorial signalRef={signalRef} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(100 + 300 + 100); }); // ticks + hold
    act(() => { vi.advanceTimersByTime(800); });             // flash
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(screen.queryByText('Hold your hands up')).toBeNull();
  });

  it('does not dissolve while hands are absent', () => {
    const onDone = vi.fn();
    render(<BeginnerTutorial signalRef={makeSignalRef()} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Hold your hands up')).toBeInTheDocument();
  });

  it('skip persists the seen flag and fires onDone', () => {
    const onDone = vi.fn();
    render(<BeginnerTutorial signalRef={makeSignalRef()} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(localStorage.getItem('froola.tutorialSeen')).toBe('true');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
