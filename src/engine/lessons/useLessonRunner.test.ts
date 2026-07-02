import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLessonRunner } from './useLessonRunner';
import type { Lesson } from './types';

function makeLesson(id: string, stepCount = 2): Lesson {
  return {
    id,
    title: 'Test lesson',
    subtitle: '',
    kind: 'technique',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `${id}-s${i}`,
      instruction: `Step ${i}`,
      targetRecording: {
        samples: [{ dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 }],
        totalMs: 100,
      },
      minScore: 60,
      durationMs: 200,
    })),
    tags: [],
  };
}

const liveSelectedRef = { current: { noteIdx: 0, qualIdx: 0 } };
const engineRef = { current: null };
const canvasRef = { current: null };
const ghostSignalsRef = { current: [] };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useLessonRunner — warm-up phase', () => {
  it('inserts a warmup phase before the first step of the first-chord lesson', () => {
    const lesson = makeLesson('first-chord');
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef)
    );

    act(() => result.current.start());
    expect(result.current.phase).toBe('preview');

    // Preview auto-advances once the target recording finishes playing.
    act(() => { vi.advanceTimersByTime(lesson.steps[0].targetRecording.totalMs + 500); });
    expect(result.current.phase).toBe('warmup');

    // Warmup is self-paced — it must not advance on its own.
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(result.current.phase).toBe('warmup');

    act(() => result.current.beginCountdown());
    expect(result.current.phase).toBe('countdown');
  });

  it('does not warm up on later steps of the same lesson', () => {
    const lesson = makeLesson('first-chord');
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef)
    );

    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(lesson.steps[0].targetRecording.totalMs + 500); });
    act(() => result.current.beginCountdown());
    act(() => { vi.advanceTimersByTime(3000); }); // countdown -> attempt
    act(() => { vi.advanceTimersByTime(lesson.steps[0].durationMs); }); // attempt -> step-result
    act(() => result.current.next());

    expect(result.current.phase).toBe('preview');
    act(() => { vi.advanceTimersByTime(lesson.steps[1].targetRecording.totalMs + 500); });
    expect(result.current.phase).toBe('countdown');
  });

  it('does not warm up on other lessons', () => {
    const lesson = makeLesson('around-the-wheel');
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef)
    );

    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(lesson.steps[0].targetRecording.totalMs + 500); });
    expect(result.current.phase).toBe('countdown');
  });
});
