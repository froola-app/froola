// Leitner-box spaced repetition: 5 boxes, each with a longer due-interval.
// A pass advances a drill to the next box (further out); a fail drops it
// back to box 1 (due again immediately).
export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30]; // index = box - 1
const DAY_MS = 24 * 60 * 60 * 1000;

export type BoxState = { box: number; dueAt: number };

export function initialBoxState(now = Date.now()): BoxState {
  return { box: 1, dueAt: now };
}

export function nextBoxState(current: BoxState, passed: boolean, now = Date.now()): BoxState {
  const box = passed
    ? Math.min(current.box + 1, LEITNER_INTERVALS_DAYS.length)
    : 1;
  return { box, dueAt: now + LEITNER_INTERVALS_DAYS[box - 1] * DAY_MS };
}

export function isDue(state: BoxState, now = Date.now()): boolean {
  return state.dueAt <= now;
}
