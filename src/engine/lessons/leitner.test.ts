import { initialBoxState, nextBoxState, isDue, LEITNER_INTERVALS_DAYS } from './leitner';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('initialBoxState', () => {
  it('starts in box 1, due immediately', () => {
    const state = initialBoxState(NOW);
    expect(state.box).toBe(1);
    expect(state.dueAt).toBe(NOW);
  });
});

describe('nextBoxState', () => {
  it('advances a box on pass and schedules the matching interval', () => {
    const state = nextBoxState({ box: 1, dueAt: NOW }, true, NOW);
    expect(state.box).toBe(2);
    expect(state.dueAt).toBe(NOW + LEITNER_INTERVALS_DAYS[1] * DAY_MS);
  });

  it('caps at the top box on repeated passes', () => {
    const state = nextBoxState({ box: LEITNER_INTERVALS_DAYS.length, dueAt: NOW }, true, NOW);
    expect(state.box).toBe(LEITNER_INTERVALS_DAYS.length);
  });

  it('resets to box 1 on fail, regardless of current box', () => {
    const state = nextBoxState({ box: 4, dueAt: NOW }, false, NOW);
    expect(state.box).toBe(1);
    expect(state.dueAt).toBe(NOW + LEITNER_INTERVALS_DAYS[0] * DAY_MS);
  });
});

describe('isDue', () => {
  it('is due when dueAt is in the past or now', () => {
    expect(isDue({ box: 1, dueAt: NOW }, NOW)).toBe(true);
    expect(isDue({ box: 1, dueAt: NOW - 1 }, NOW)).toBe(true);
  });

  it('is not due when dueAt is in the future', () => {
    expect(isDue({ box: 1, dueAt: NOW + 1 }, NOW)).toBe(false);
  });
});
