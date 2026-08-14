import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readProgress, writeProgress, saveProgressEntry } from './progressStore';

beforeEach(() => localStorage.clear());

describe('progressStore', () => {
  it('starts empty', () => {
    expect(readProgress('lesson')).toEqual({});
  });

  it('round-trips a map', () => {
    writeProgress('lesson', { 'first-chord': { bestScore: 3, attempts: 1 } });
    expect(readProgress('lesson')).toEqual({ 'first-chord': { bestScore: 3, attempts: 1 } });
  });

  it('keeps lesson and review progress apart', () => {
    writeProgress('lesson', { a: 1 });
    writeProgress('review', { b: 2 });
    expect(readProgress('lesson')).toEqual({ a: 1 });
    expect(readProgress('review')).toEqual({ b: 2 });
  });

  it('adds one entry without disturbing the others', () => {
    writeProgress('review', { a: 1, b: 2 });
    saveProgressEntry('review', 'c', 3);
    expect(readProgress('review')).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('overwrites an entry it already has', () => {
    saveProgressEntry('lesson', 'a', 1);
    saveProgressEntry('lesson', 'a', 2);
    expect(readProgress('lesson')).toEqual({ a: 2 });
  });

  // A hand-edited or half-written value must not take the lessons page down.
  it('ignores a stored value that is not an object map', () => {
    localStorage.setItem('froola.lessonProgress', 'not json at all');
    expect(readProgress('lesson')).toEqual({});

    localStorage.setItem('froola.lessonProgress', '[1, 2, 3]');
    expect(readProgress('lesson')).toEqual({});

    localStorage.setItem('froola.lessonProgress', 'null');
    expect(readProgress('lesson')).toEqual({});
  });
});

describe('progressStore with storage unavailable', () => {
  const setItem = Storage.prototype.setItem;
  const getItem = Storage.prototype.getItem;

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
  });
  afterEach(() => {
    Storage.prototype.setItem = setItem;
    Storage.prototype.getItem = getItem;
  });

  it('reads empty and swallows write failures', () => {
    expect(readProgress('lesson')).toEqual({});
    expect(() => writeProgress('lesson', { a: 1 })).not.toThrow();
    expect(() => saveProgressEntry('lesson', 'a', 1)).not.toThrow();
  });
});
