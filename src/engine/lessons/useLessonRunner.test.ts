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
        samples: [
          ...Array.from({ length: 10 }, () => ({ dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 })),
          ...Array.from({ length: 10 }, () => ({ dt: 100, noteIdx: 3, qualityIdx: 0, vibe: 0 })),
        ],
        totalMs: 2000,
      },
      minScore: 60,
      durationMs: 2000,
    })),
    tags: [],
  };
}

const liveSelectedRef = { current: { noteIdx: 0, qualIdx: 0 } };
const engineRef = { current: null };
const canvasRef = { current: null };
const ghostSignalsRef = { current: [] };

beforeEach(() => vi.useFakeTimers());
beforeEach(() => { liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 }; });
afterEach(() => vi.useRealTimers());

describe('useLessonRunner — practice phase', () => {
  it('enters practice after preview on a non-final step', () => {
    const lesson = makeLesson('l1', 2);
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    expect(result.current.phase).toBe('preview');
    act(() => { vi.advanceTimersByTime(2000 + 500); });
    expect(result.current.phase).toBe('practice');
    expect(result.current.practiceChordCount).toBe(2);
    expect(result.current.practiceChordIndex).toBe(0);
    expect(result.current.practiceTarget).toEqual({ noteIdx: 0, qualIdx: 0 });
  });

  it('advances a chord after 700ms of continuous match, resetting on mismatch', () => {
    const lesson = makeLesson('l1', 2);
    liveSelectedRef.current = { noteIdx: 6, qualIdx: 0 }; // wrong chord
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2500); }); // → practice

    act(() => { vi.advanceTimersByTime(2000); }); // wrong chord: no advance
    expect(result.current.practiceChordIndex).toBe(0);

    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(400); }); // partial dwell…
    liveSelectedRef.current = { noteIdx: 6, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(200); }); // …broken by mismatch
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(600); }); // 600 < 700: not yet
    expect(result.current.practiceChordIndex).toBe(0);
    act(() => { vi.advanceTimersByTime(200); }); // 800ms continuous
    expect(result.current.practiceChordIndex).toBe(1);
    expect(result.current.practiceTarget).toEqual({ noteIdx: 3, qualIdx: 0 });
  });

  it('finishing practice on a non-final step flows straight into the next preview', () => {
    const lesson = makeLesson('l1', 2);
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2500); }); // → practice, chord 0
    act(() => { vi.advanceTimersByTime(800); });  // chord 0 done
    liveSelectedRef.current = { noteIdx: 3, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(800); });  // chord 1 done → step complete
    expect(result.current.phase).toBe('preview'); // next step, no step-result
    expect(result.current.stepIndex).toBe(1);
    expect(result.current.stepResults[0]).toMatchObject({ passed: true, score: 100 });
  });

  it('the final step goes preview → countdown → attempt (no practice)', () => {
    const lesson = makeLesson('l1', 2);
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2500); });
    act(() => { vi.advanceTimersByTime(800); });
    liveSelectedRef.current = { noteIdx: 3, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(800); }); // → step 1 preview
    act(() => { vi.advanceTimersByTime(2500); }); // preview over
    expect(result.current.phase).toBe('countdown');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.phase).toBe('attempt');
  });

  it('a single-step lesson practices first, then counts down into the attempt', () => {
    const lesson = makeLesson('solo', 1);
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2500); });
    expect(result.current.phase).toBe('practice');
    act(() => { vi.advanceTimersByTime(800); });
    liveSelectedRef.current = { noteIdx: 3, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current.phase).toBe('countdown');
    expect(result.current.stepIndex).toBe(0);
  });
});

describe('useLessonRunner — per-chord attempt scoring', () => {
  it('scores 100 when every chord is matched during the attempt, despite late transitions', () => {
    const lesson = makeLesson('l1', 1);
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    const { result } = renderHook(() =>
      useLessonRunner(lesson, liveSelectedRef, engineRef, canvasRef, ghostSignalsRef));
    act(() => result.current.start());
    act(() => { vi.advanceTimersByTime(2500); }); // preview
    act(() => { vi.advanceTimersByTime(800); });  // practice chord 0
    liveSelectedRef.current = { noteIdx: 3, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(800); });  // practice done → countdown
    liveSelectedRef.current = { noteIdx: 0, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(3000); }); // → attempt
    // Switch to the second chord 300ms LATE (t=1300 of 1000–2000 span).
    act(() => { vi.advanceTimersByTime(1300); });
    liveSelectedRef.current = { noteIdx: 3, qualIdx: 0 };
    act(() => { vi.advanceTimersByTime(700); });  // attempt window ends
    expect(result.current.phase).toBe('step-result');
    expect(result.current.stepResults[0].score).toBe(100);
    expect(result.current.stepResults[0].passed).toBe(true);
  });
});
