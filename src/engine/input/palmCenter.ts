// Center of the palm: mean of the wrist and the four finger MCP knuckles.
// Used as the reported hand position while a fist is held, so the lock
// lands where the fist is — not wherever the curled index fingertip ends up.
const PALM_IDX = [0, 5, 9, 13, 17];

export function palmCenter(lm: { x: number; y: number }[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const i of PALM_IDX) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / PALM_IDX.length, y: y / PALM_IDX.length };
}
