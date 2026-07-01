import { scoreFrame, accuracy, combinedScore } from './scorer';

describe('scoreFrame', () => {
  it('hits both note and quality on an exact match', () => {
    expect(scoreFrame(0, 0, 0, 0)).toEqual({ noteHit: true, qualHit: true });
  });

  it('hits only note when quality differs', () => {
    expect(scoreFrame(0, 2, 0, 5)).toEqual({ noteHit: true, qualHit: false });
  });

  it('hits only quality when note differs', () => {
    expect(scoreFrame(0, 2, 4, 2)).toEqual({ noteHit: false, qualHit: true });
  });

  it('misses both when neither matches', () => {
    expect(scoreFrame(0, 0, 4, 5)).toEqual({ noteHit: false, qualHit: false });
  });
});

describe('accuracy', () => {
  it('returns 0 for an empty frame list', () => {
    expect(accuracy([])).toBe(0);
  });

  it('returns 100 when every frame hits', () => {
    expect(accuracy([true, true, true])).toBe(100);
  });

  it('returns 0 when every frame misses', () => {
    expect(accuracy([false, false])).toBe(0);
  });

  it('rounds partial accuracy', () => {
    expect(accuracy([true, false, true])).toBe(67); // 2/3 -> 66.67 -> 67
  });
});

describe('combinedScore', () => {
  it('matches the old 50/50 weighting', () => {
    expect(combinedScore(100, 0)).toBe(50);
    expect(combinedScore(0, 100)).toBe(50);
    expect(combinedScore(100, 100)).toBe(100);
    expect(combinedScore(0, 0)).toBe(0);
  });

  it('rounds the average', () => {
    expect(combinedScore(67, 100)).toBe(84); // 83.5 -> 84
  });
});
