import { describe, it, expect } from 'vitest';
import { CURRICULUM, LEARNING_PATH, lessonById, nextLessonAfter, starsForScore } from './curriculum';
import { SONGS } from './songs';

describe('learning path', () => {
  it('contains every technique lesson and every song exactly once', () => {
    const ids = LEARNING_PATH.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of [...CURRICULUM, ...SONGS]) expect(ids).toContain(l.id);
    expect(ids.length).toBe(CURRICULUM.length + SONGS.length);
  });

  it('starts with a technique lesson and looks up by id', () => {
    expect(LEARNING_PATH[0].kind).toBe('technique');
    expect(lessonById('song-let-it-be')?.title).toBe('Let It Be');
  });

  it('walks to the next lesson and ends after the last', () => {
    expect(nextLessonAfter(LEARNING_PATH[0].id)?.id).toBe(LEARNING_PATH[1].id);
    expect(nextLessonAfter(LEARNING_PATH[LEARNING_PATH.length - 1].id)).toBeUndefined();
  });
});

describe('song lessons', () => {
  it('every song has an artist, bpm, and progression chips', () => {
    for (const s of SONGS) {
      expect(s.kind).toBe('song');
      expect(s.artist).toBeTruthy();
      expect(s.bpm).toBeGreaterThan(0);
      expect(s.progression?.length).toBeGreaterThan(1);
    }
  });

  it('every song bpm keeps chord boundaries on the 100ms sample grid', () => {
    for (const s of SONGS) {
      expect((60000 / s.bpm!) % 100).toBe(0);
    }
  });

  it('step durations match their target recordings', () => {
    for (const s of SONGS) {
      for (const step of s.steps) {
        expect(step.durationMs).toBe(step.targetRecording.totalMs);
        expect(step.targetRecording.samples.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('starsForScore', () => {
  it('maps pass/80/92 thresholds to 1/2/3 stars', () => {
    expect(starsForScore(60)).toBe(1);
    expect(starsForScore(79)).toBe(1);
    expect(starsForScore(80)).toBe(2);
    expect(starsForScore(91)).toBe(2);
    expect(starsForScore(92)).toBe(3);
    expect(starsForScore(100)).toBe(3);
  });
});
