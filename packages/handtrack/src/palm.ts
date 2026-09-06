// Center of the palm: the mean of the wrist and the four finger knuckles.
//
// Two jobs. It is the position reported while a fist is held, so the lock lands
// where the fist actually is rather than wherever the curled index fingertip
// ended up. It is also what slot assignment measures, because unlike a
// fingertip it barely moves as the hand opens and closes — assignment should
// not wobble just because someone made a fist.

import type { Landmark, Point } from './types';

const PALM_IDX = [0, 5, 9, 13, 17] as const;

export function palmCenter(lm: Landmark[]): Point {
  let x = 0;
  let y = 0;
  for (const i of PALM_IDX) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / PALM_IDX.length, y: y / PALM_IDX.length };
}
