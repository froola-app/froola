import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import type { AudioEngine } from '../audio';
import type { DialSelection } from '../renderer';
import type { GestureSignal, Recording } from '../types';
import type { Lesson } from './types';
import { buildCommand } from '../music';
import { useLessonRunner } from './useLessonRunner';

function makeLesson(): Lesson {
  const targetRecording: Recording = {
    samples: [
      { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 },
      { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 },
      { dt: 100, noteIdx: 4, qualityIdx: 0, vibe: 0 },
    ],
    totalMs: 300,
  };
  return {
    id: 'test-lesson',
    title: 'Test',
    subtitle: 'Test lesson',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [
      { id: 's1', instruction: 'Play it', targetRecording, minScore: 50, durationMs: 300 },
    ],
    tags: [],
  };
}

describe('useLessonRunner preview audio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays the target chord sequence directly when preview starts', () => {
    const lesson = makeLesson();
    const play = vi.fn();
    const silence = vi.fn();
    const engineRef = { current: { play, silence } as unknown as AudioEngine };
    const liveSelectedRef: RefObject<DialSelection> = { current: { noteIdx: 0, qualIdx: 0 } };
    const canvasRef: RefObject<HTMLCanvasElement | null> = { current: null };
    const ghostSignalsRef: RefObject<GestureSignal[]> = { current: [] };

    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef)
    );

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe('preview');

    // First segment (noteIdx=0) is scheduled at t=0 — flush the 0ms timeout.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenNthCalledWith(
      1,
      buildCommand(0, 0, 0.5, 0, lesson.musicConfig),
      'synth'
    );

    // Samples 1+2 share noteIdx=0 (no new segment); sample 3 changes to
    // noteIdx=4 at the 200ms mark.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenNthCalledWith(
      2,
      buildCommand(4, 0, 0.5, 0, lesson.musicConfig),
      'synth'
    );
  });

  it('does not schedule preview playback when no engine is attached yet', () => {
    const lesson = makeLesson();
    const engineRef: RefObject<AudioEngine | null> = { current: null };
    const liveSelectedRef: RefObject<DialSelection> = { current: { noteIdx: 0, qualIdx: 0 } };
    const canvasRef: RefObject<HTMLCanvasElement | null> = { current: null };
    const ghostSignalsRef: RefObject<GestureSignal[]> = { current: [] };

    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef)
    );

    expect(() => {
      act(() => {
        result.current.start();
        vi.advanceTimersByTime(300);
      });
    }).not.toThrow();
  });
});
