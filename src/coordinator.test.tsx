import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';
import { useRef as useRefForGate } from 'react';
import { useRef } from 'react';
import { mockAudioContext } from './test-utils/webAudioMock';
import { useCoordinator } from './coordinator';
import { AudioEngine } from './engine/audio';
import type { InstrumentMode } from './engine/types';

vi.mock('soundfont-player', () => ({
  default: { instrument: vi.fn(() => Promise.resolve({ play: vi.fn(), stop: vi.fn() })) },
}));

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

describe('useCoordinator — pause on tab hidden', () => {
  it('suspends audio when the tab becomes hidden and resumes when visible', () => {
    renderHook(() => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const modeRef = useRef<InstrumentMode>('synth');
      return useCoordinator(canvasRef, modeRef, 'asking');
    });

    // Construction already exercised suspend/resume; clear to isolate the event.
    mockAudioContext.suspend.mockClear();
    mockAudioContext.resume.mockClear();

    setHidden(true);
    expect(mockAudioContext.suspend).toHaveBeenCalled();

    setHidden(false);
    expect(mockAudioContext.resume).toHaveBeenCalled();
  });
});

describe('useCoordinator — gated audio unlock', () => {
  it('never calls engine.resume() from the pointerdown unlock listener while gated', () => {
    renderHook(() => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const modeRef = useRef<InstrumentMode>('synth');
      const gatedRef = useRefForGate(true);
      return useCoordinator(canvasRef, modeRef, 'asking', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, gatedRef);
    });

    mockAudioContext.resume.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });

  it('never calls engine.resume() from visibilitychange while gated', () => {
    renderHook(() => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const modeRef = useRef<InstrumentMode>('synth');
      const gatedRef = useRefForGate(true);
      return useCoordinator(canvasRef, modeRef, 'asking', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, gatedRef);
    });

    mockAudioContext.resume.mockClear();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });
});

describe('useCoordinator — returned refs', () => {
  it('returns a sustainedRef the hot loop writes into', () => {
    const { result } = renderHook(() => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const modeRef = useRef<InstrumentMode>('synth');
      return useCoordinator(canvasRef, modeRef, 'asking');
    });

    expect(result.current.sustainedRef).toBeDefined();
    expect(result.current.sustainedRef.current).toBe(false);
  });
});

describe('useCoordinator — gated hot loop', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call engine.play() from gesture signals while gated', () => {
    const signalRef = { current: [
      { handId: 'left' as const, x: 0.15, y: 0.5, present: true, fist: false },
    ] };
    const playSpy = vi.spyOn(AudioEngine.prototype, 'play');

    renderHook(() => {
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const modeRef = useRef<InstrumentMode>('synth');
      const gatedRef = useRefForGate(true);
      return useCoordinator(canvasRef, modeRef, 'asking', undefined, signalRef, undefined, undefined, undefined, undefined, undefined, undefined, gatedRef);
    });

    // Drive one rAF tick.
    act(() => { vi.advanceTimersByTime(16); });

    expect(playSpy).not.toHaveBeenCalled();
    playSpy.mockRestore();
  });
});
