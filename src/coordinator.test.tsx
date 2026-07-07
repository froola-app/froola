import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef as useRefForGate } from 'react';
import { useRef } from 'react';
import { mockAudioContext } from './test-utils/webAudioMock';
import { useCoordinator } from './coordinator';
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
      return useCoordinator(canvasRef, modeRef, 'mouse');
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
      return useCoordinator(canvasRef, modeRef, 'mouse', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, gatedRef);
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
      return useCoordinator(canvasRef, modeRef, 'mouse', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, gatedRef);
    });

    mockAudioContext.resume.mockClear();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockAudioContext.resume).not.toHaveBeenCalled();
  });
});
